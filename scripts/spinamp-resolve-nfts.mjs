// Read-only, bounded, resumable exact NFT relation recovery from the public index.
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  renameSync,
} from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { extractMusicMetadata } from "../src/extract-music-metadata.mjs";
const endpoint = "https://api.spinamp.xyz/v3/graphql",
  path = "data/spinamp/nft-references.json.gz";
const inv = JSON.parse(
  gunzipSync(readFileSync("data/spinamp/inventory.json.gz")),
);
const previous = existsSync(path)
  ? JSON.parse(gunzipSync(readFileSync(path)))
  : {
      source: endpoint,
      startedAt: new Date().toISOString(),
      references: {},
      failures: {},
    };
const priority = (r) =>
  /pete rango|p3t3rango/i.test(r.artistByArtistId?.name || "")
    ? 0
    : r.platformId === "sound"
      ? 1
      : r.platformId === "zora"
        ? 2
        : 3;
const remaining = inv.records
  .filter(
    (r) =>
      !Object.hasOwn(previous.references, r.id) ||
      (previous.references[r.id] && !previous.references[r.id].musicMetadata),
  )
  .sort((a, b) => priority(a) - priority(b));
const size = 25,
  max = Number(process.env.SPINAMP_MAX_BATCHES || 2200);
let queries = 0;
function compact(n) {
  if (!n) return null;
  const m = n.metadata || {};
  return {
    ...n,
    metadata: undefined,
    tokenUri: n.tokenUri?.startsWith("data:") ? null : n.tokenUri,
    tokenMetadataUri: n.tokenMetadataUri?.startsWith("data:")
      ? null
      : n.tokenMetadataUri,
    musicMetadata: extractMusicMetadata(m),
    mediaURI: m.animation_url || m.audio_url || m.audio || null,
    imageURI: m.image || null,
    metadataTitle: m.title || m.name || null,
    metadataArtist: m.artist || m.artist_name || null,
    bpm: m.bpm ?? null,
    key: m.key ?? null,
    genre: m.genre ?? null,
    metadataSha256: createHash("sha256")
      .update(JSON.stringify(m))
      .digest("hex"),
  };
}
function save() {
  previous.updatedAt = new Date().toISOString();
  previous.resolvedCount = Object.keys(previous.references).length;
  previous.inventoryCount = inv.records.length;
  previous.complete = previous.resolvedCount === inv.records.length;
  writeFileSync(path + ".tmp", gzipSync(JSON.stringify(previous)));
  renameSync(path + ".tmp", path);
}
for (let start = 0; start < remaining.length && queries < max; start += size) {
  const group = remaining.slice(start, start + size);
  const query =
    "{" +
    group
      .map(
        (r, i) =>
          `t${i}:allNftsProcessedTracks(condition:{processedTrackId:${JSON.stringify(r.id)}},first:1){nodes{nftByNftId{id chainId contractAddress tokenId tokenUri tokenMetadataUri mimeType createdAtTime createdAtBlockNumber metadata nftFactoryByNftFactoryId{standard}}}}`,
      )
      .join("\n") +
    "}";
  queries++;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) throw Error("HTTP " + response.status);
    const result = await response.json();
    for (let i = 0; i < group.length; i++) {
      const field = "t" + i;
      if (
        result.errors?.some((e) => !e.path || e.path[0] === field) ||
        !result.data?.[field]
      ) {
        previous.failures[group[i].id] =
          result.errors?.[0]?.message || "Missing response";
        continue;
      }
      previous.references[group[i].id] = compact(
        result.data[field].nodes[0]?.nftByNftId,
      );
      delete previous.failures[group[i].id];
    }
    save();
    if (queries % 10 === 0)
      console.log(
        JSON.stringify({
          batch: queries,
          resolved: previous.resolvedCount,
          errors: Object.keys(previous.failures).length,
          complete: previous.complete,
        }),
      );
  } catch (e) {
    console.error(e.message);
    save();
    break;
  }
  await new Promise((r) => setTimeout(r, 120));
}
save();
