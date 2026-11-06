// Read-only, resumable Sound factory discovery. No private API key required.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { readNFT, storageURL } from "../src/nft-reader.mjs";
import { soundDeployment, decodeFactoryEvent } from "./sound-contracts.mjs";
const chainId = Number(process.env.SOUND_CHAIN_ID || 1);
const indexers = { 1: "eth.blockscout.com", 10: "optimism.blockscout.com" };
if (!indexers[chainId]) throw Error("Unsupported discovery chain");
const version = Number(process.env.SOUND_VERSION || 2);
const deployment = soundDeployment(version, chainId);
const { factory } = deployment;
const defaultState =
  version === 2 && chainId === 1
    ? "sound-v2-index.json"
    : `sound-v${version}-${chainId}-index.json`;
const file = new URL(
  "../data/" + (process.env.SOUND_STATE_FILE || defaultState),
  import.meta.url,
);
let state;
try {
  state = JSON.parse(await readFile(file, "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
state ||= {
  version,
  chainId,
  factory,
  source: deployment.source,
  discoveryUnit: deployment.unit,
  startedAt: new Date().toISOString(),
  cursor: null,
  discoveryComplete: false,
  collections: [],
  records: [],
};
if (state.chainId !== chainId || state.factory !== factory)
  throw Error("Checkpoint does not match selected factory");
await mkdir(new URL("../data/", import.meta.url), { recursive: true });
async function save() {
  await writeFile(file, JSON.stringify(state, null, 2) + "\n");
}
async function get(path) {
  const response = await fetch(`https://${indexers[chainId]}/api/v2/` + path, {
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw Error(`Indexer HTTP ${response.status}`);
  return response.json();
}
const limit = Number(process.env.SOUND_PAGE_LIMIT || 100);
for (let page = 0; page < limit && !state.discoveryComplete; page++) {
  const query = state.cursor ? "?" + new URLSearchParams(state.cursor) : "";
  const result = await get(`addresses/${factory}/logs${query}`);
  if (!Array.isArray(result.items)) throw Error("Invalid logs response");
  for (const event of result.items) {
    const discovered = decodeFactoryEvent(event, deployment);
    if (
      !discovered ||
      state.collections.some((c) => c.contract === discovered.contract)
    )
      continue;
    if (version === 0)
      discovered.artistName =
        event.decoded?.parameters?.find((p) => p.name === "name")?.value ||
        null;
    state.collections.push(discovered);
  }
  state.cursor = result.next_page_params || null;
  state.discoveryComplete = !state.cursor;
  state.checkedAt = new Date().toISOString();
  await save();
  console.log(
    `Discovered ${state.collections.length} V${version} chain ${chainId} collections; pagination complete: ${state.discoveryComplete}`,
  );
}
// One representative minted edition per collection. The collection browser paginates other editions.
const hydrationLimit =
  version === 0 ? 0 : Number(process.env.SOUND_HYDRATE_LIMIT || 30);
let hydrated = 0;
for (const collection of state.collections) {
  if (
    collection.mediaStatus === "representative-indexed" ||
    (process.env.SOUND_RETRY !== "1" &&
      (collection.metadataCheckedAt || collection.lastAttemptAt)) ||
    hydrated >= hydrationLimit
  )
    continue;
  let result;
  try {
    result = await get(`tokens/${collection.contract}/instances`);
  } catch (error) {
    collection.lastError = error.message;
    collection.lastAttemptAt = new Date().toISOString();
    await save();
    hydrated++;
    continue;
  }
  if (!Array.isArray(result.items)) throw Error("Invalid instances response");
  let item = result.items.find(
    (i) => i.metadata?.animation_url && /^\d{1,78}$/.test(String(i.id)),
  );
  if (!item && result.items[0]) {
    const candidate = result.items[0];
    const resolved = await readNFT({
      chainId,
      contract: collection.contract,
      tokenId: String(candidate.id),
    });
    if (resolved.status === "live") {
      item = {
        id: candidate.id,
        metadata: {
          name: resolved.title,
          artist_name: resolved.artist,
          image: resolved.imageURI,
          animation_url: resolved.mediaURI,
        },
      };
      collection.checkedBlock = resolved.blockNumber;
    }
  }
  if (item) {
    const m = item.metadata;
    try {
      storageURL(m.animation_url);
      const title = String(m.name || "Untitled recording").replace(
        / #\d+$/,
        "",
      );
      const artist = String(
        m.artist_name || m.artist || "Artist not identified in metadata",
      );
      state.records.push({
        id: `sound-v${version}-${chainId}-${collection.contract.slice(2)}`,
        artist,
        title,
        chainId,
        contract: collection.contract,
        tokenId: String(item.id),
        kind: /\.(mp4|webm)(\?|$)/i.test(m.animation_url) ? "video" : "audio",
        imageURI: m.image || null,
        platform: "Sound",
        collection: title,
        note: "Discovered from Sound’s verified factory. Artist and title follow edition metadata.",
        discovery: state.source,
        checkedAt: new Date().toISOString(),
        originalRelease: /^https:\/\/(www\.)?sound\.xyz\//.test(
          m.external_url || "",
        )
          ? m.external_url
          : undefined,
      });
      collection.mediaStatus = "representative-indexed";
    } catch {
      collection.mediaStatus = "unsupported-storage";
    }
  } else
    collection.mediaStatus = result.items.length
      ? "metadata-unavailable"
      : "no-indexed-editions";
  collection.metadataCheckedAt = new Date().toISOString();
  hydrated++;
  await save();
  console.log(
    `Metadata checked ${hydrated}; ${state.records.length} representative recordings`,
  );
}
await writeFile(
  new URL(
    process.env.SOUND_OUTPUT_FILE ||
      (version === 2
        ? `../src/sound-import-${chainId}.js`
        : version === 1 && chainId === 1
          ? "../src/sound-import-v1-1.js"
          : `../data/sound-v${version}-${chainId}-import.js`),
    import.meta.url,
  ),
  `// Generated by scripts/import-sound.mjs; representative editions, not a complete Sound archive.\nexport const soundImport = ${JSON.stringify(state.records, null, 2)};\n`,
);
