// Read-only legacy artist-contract inventory. Records mint history, not current owners.
import { readFile, writeFile } from "node:fs/promises";
import { readNFT } from "../src/nft-reader.mjs";
import { soundDeployment } from "./sound-contracts.mjs";
const deployment = soundDeployment(0, 1);
import {
  mintTransferTopic as transfer,
  zeroTopic as zero,
  purchaseTopics as purchases,
  decodeLegacyMint,
  decodeLegacyPurchase,
} from "./sound-legacy-events.mjs";
const input = JSON.parse(
  await readFile(new URL("../data/sound-v0-1-index.json", import.meta.url)),
);
const file = new URL("../data/sound-legacy-mints.json", import.meta.url);
let state;
try {
  state = JSON.parse(await readFile(file));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
async function rpc(method, params) {
  const r = await fetch("https://ethereum-rpc.publicnode.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(12000),
  });
  const d = await r.json();
  if (d.error || !d.result) throw Error("RPC unavailable");
  return d.result;
}
state ||= {
  source: deployment.source,
  factory: deployment.factory,
  chainId: 1,
  toBlock: parseInt(await rpc("eth_blockNumber", []), 16),
  startedAt: new Date().toISOString(),
  artists: [],
  records: [],
};
async function save() {
  await writeFile(file, JSON.stringify(state, null, 2) + "\n");
  await writeFile(
    new URL("../data/sound-legacy-records.js", import.meta.url),
    `// Original token metadata, grouped by legacy purchase-event edition.\nexport const soundLegacyImport = ${JSON.stringify(state.records, null, 2)};\n`,
  );
}
let lastLogRequest = 0;
async function fetchLogPage(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(0, 1500 - (Date.now() - lastLogRequest))),
    );
    lastLogRequest = Date.now();
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (response.status !== 429) return response;
    if (attempt === 3)
      throw Error(
        "Log index rate limit; checkpoint retained for a later retry",
      );
    const retrySeconds = Number(response.headers.get("retry-after"));
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        Number.isFinite(retrySeconds) && retrySeconds > 0
          ? Math.min(retrySeconds * 1000, 30000)
          : 3000 * 2 ** attempt,
      ),
    );
  }
}
async function logs(address, topic, fromBlock, toBlock, mints = false) {
  const q = new URLSearchParams({
    module: "logs",
    action: "getLogs",
    fromBlock: String(fromBlock),
    toBlock: String(toBlock),
    address,
    topic0: topic,
  });
  if (mints) {
    q.set("topic1", zero);
    q.set("topic0_1_opr", "and");
  }
  const response = await fetchLogPage("https://eth.blockscout.com/api?" + q);
  if (!response.ok) throw Error("Log index HTTP " + response.status);
  const data = await response.json();
  if (data.status === "0" && data.message === "No logs found") return [];
  if (data.status !== "1" || !Array.isArray(data.result))
    throw Error("Log index unavailable: " + data.message);
  if (data.result.length >= 1000) {
    if (fromBlock >= toBlock) throw Error("Single-block log cap exceeded");
    const mid = Math.floor((fromBlock + toBlock) / 2);
    return [
      ...(await logs(address, topic, fromBlock, mid, mints)),
      ...(await logs(address, topic, mid + 1, toBlock, mints)),
    ];
  }
  return data.result.filter(
    (e) =>
      e.address?.toLowerCase() === address &&
      e.topics?.[0] === topic &&
      (!mints || e.topics[1] === zero),
  );
}
const limit = Number(process.env.SOUND_LEGACY_ARTIST_LIMIT || 10);
const priorities =
  /charm|cam murdoch|xcelencia|dutch|^the park$|iman europe|black dave|tarot|sound of fractures|lackhoney|\baly\b|jamee|sara phillips/i;
const artists = [...input.collections].sort(
  (a, b) =>
    Number(priorities.test(b.artistName || "")) -
    Number(priorities.test(a.artistName || "")),
);
let attempted = 0;
for (const artist of artists) {
  if (attempted >= limit) break;
  if (
    state.artists.some(
      (a) => a.contract === artist.contract && a.status === "indexed",
    )
  )
    continue;
  attempted++;
  try {
    const minted = await logs(
      artist.contract,
      transfer,
      artist.createdBlock,
      state.toBlock,
      true,
    );
    const events = [
      ...(await logs(
        artist.contract,
        purchases[0],
        artist.createdBlock,
        state.toBlock,
      )),
      ...(await logs(
        artist.contract,
        purchases[1],
        artist.createdBlock,
        state.toBlock,
      )),
    ];
    const mintRecords = minted
      .map((e) => decodeLegacyMint(e, artist.contract))
      .filter(Boolean);
    const mintIds = new Set(mintRecords.map((e) => e.tokenId));
    const releases = new Map();
    for (const e of events) {
      const purchase = decodeLegacyPurchase(e, artist.contract, mintIds);
      if (!purchase) continue;
      if (!releases.has(purchase.editionId))
        releases.set(purchase.editionId, []);
      releases.get(purchase.editionId).push(purchase);
    }
    const entry = {
      contract: artist.contract,
      name: artist.artistName,
      fromBlock: artist.createdBlock,
      toBlock: state.toBlock,
      status: "indexed",
      mintedTokenCount: mintIds.size,
      mintedTokens: mintRecords,
      releases: [],
    };
    for (const [editionId, tokens] of releases) {
      const release = {
        editionId,
        mintedPurchaseTokenCount: tokens.length,
        status: "unavailable",
      };
      for (const token of tokens.slice(-3).reverse()) {
        const result = await readNFT({
          chainId: 1,
          contract: artist.contract,
          tokenId: token.tokenId,
          kind: "audio",
        });
        if (result.status !== "live") continue;
        const record = {
          id: `sound-legacy-${artist.contract.slice(2)}-${editionId}`,
          artist: result.artist || artist.artistName,
          title: result.title.replace(/ #\d+$/, ""),
          chainId: 1,
          contract: artist.contract,
          tokenId: token.tokenId,
          kind: "audio",
          imageURI: result.imageURI || result.imageURL,
          platform: "Sound",
          collection: result.title.replace(/ #\d+$/, ""),
          note: "Original Sound artist-contract release. Edition grouping follows purchase events, with a matching mint event for this token.",
          discovery: deployment.source,
          checkedBlock: result.blockNumber,
          checkedAt: result.checkedAt,
        };
        if (!state.records.some((r) => r.id === record.id))
          state.records.push(record);
        release.status = "resolved";
        release.recordId = record.id;
        break;
      }
      entry.releases.push(release);
    }
    state.artists = state.artists.filter((a) => a.contract !== artist.contract);
    state.artists.push(entry);
    console.log(
      `${entry.name}: ${entry.mintedTokenCount} minted tokens; ${entry.releases.length} release groups; ${entry.releases.filter((r) => r.status === "resolved").length} resolved`,
    );
  } catch (e) {
    state.artists = state.artists.filter((a) => a.contract !== artist.contract);
    state.artists.push({
      contract: artist.contract,
      name: artist.artistName,
      status: "unavailable",
      error: e.message,
    });
    console.log(artist.artistName, e.message);
    if (e.message.includes("rate limit")) {
      state.retryable = true;
      state.stoppedReason = e.message;
      await save();
      break;
    }
  }
  await save();
}
