// Public index reads only; exact representative NFT relation, bounded and resumable.
import {
  readFileSync,
  writeFileSync,
  existsSync,
  renameSync,
  openSync,
  closeSync,
  unlinkSync,
} from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { extractMusicMetadata } from "../src/extract-music-metadata.mjs";
const endpoint = "https://api.spinamp.xyz/v3/graphql";
export function needsRelationRetry(state, trackId) {
  return (
    Object.hasOwn(state.failures || {}, trackId) ||
    !Object.hasOwn(state.references, trackId) ||
    (state.references[trackId] !== null &&
      !state.references[trackId]?.musicMetadata)
  );
}
export function applyRelationResponse(state, group, result) {
  state.failures ||= {};
  state.relationCounts ||= {};
  for (let i = 0; i < group.length; i++) {
    const id = group[i].id,
      field = "t" + i,
      item = result.data?.[field];
    const errors = result.errors?.filter((e) => !e.path || e.path[0] === field);
    if (
      errors?.length ||
      !Array.isArray(item?.nodes) ||
      !Number.isSafeInteger(item.totalCount) ||
      item.totalCount < 0 ||
      (item.totalCount > 0 &&
        (!item.nodes.length || !item.nodes[0]?.nftByNftId))
    ) {
      state.failures[id] =
        errors?.[0]?.message || "Incomplete NFT relation response";
      continue;
    }
    if (item.totalCount === 0 && item.nodes.length) {
      state.failures[id] = "Inconsistent empty NFT relation";
      continue;
    }
    state.references[id] = compactNft(item.nodes[0]?.nftByNftId);
    state.relationCounts[id] = item.totalCount;
    delete state.failures[id];
  }
  return state;
}
export function compactNft(n) {
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
    musicMetadataSchemaVersion: 5,
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

export async function resolveNfts() {
  const path = "data/spinamp/nft-references.json.gz",
    lockPath = path + ".lock";
  const lock = openSync(lockPath, "wx");
  writeFileSync(lock, String(process.pid));
  closeSync(lock);
  let stopRequested = false;
  const stop = () => {
    stopRequested = true;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
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
      .filter((r) => needsRelationRetry(previous, r.id))
      .sort((a, b) => priority(a) - priority(b));
    const size = Number(process.env.SPINAMP_BATCH_SIZE || 10),
      max = Number(process.env.SPINAMP_MAX_BATCHES || 100);
    if (
      !Number.isInteger(size) ||
      size < 1 ||
      size > 25 ||
      !Number.isInteger(max) ||
      max < 1 ||
      max > 2200
    )
      throw Error("Invalid bounded batch settings");
    let queries = 0;
    function save() {
      previous.updatedAt = new Date().toISOString();
      previous.resolvedCount = inv.records.filter((r) =>
        Object.hasOwn(previous.references, r.id),
      ).length;
      previous.inventoryCount = inv.records.length;
      previous.pendingCount = inv.records.filter((r) =>
        needsRelationRetry(previous, r.id),
      ).length;
      previous.complete = previous.pendingCount === 0;
      previous.relationScope =
        "One indexed representative NFT per processed track, not every edition or mint. relationCounts records total only for reads using the newer query.";
      writeFileSync(path + ".tmp", gzipSync(JSON.stringify(previous)));
      renameSync(path + ".tmp", path);
    }
    console.log(
      JSON.stringify({
        pending: remaining.length,
        batchSize: size,
        maxBatches: max,
      }),
    );
    for (
      let start = 0;
      start < remaining.length && queries < max && !stopRequested;
      start += size
    ) {
      const group = remaining.slice(start, start + size);
      const query =
        "{" +
        group
          .map(
            (r, i) =>
              `t${i}:allNftsProcessedTracks(condition:{processedTrackId:${JSON.stringify(r.id)}},first:1,orderBy:PRIMARY_KEY_ASC){totalCount nodes{nftByNftId{id chainId contractAddress tokenId tokenUri tokenMetadataUri mimeType createdAtTime createdAtBlockNumber metadata nftFactoryByNftFactoryId{standard}}}}`,
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
        applyRelationResponse(previous, group, await response.json());
        save();
        if (queries % 5 === 0)
          console.log(
            JSON.stringify({
              batch: queries,
              resolved: previous.resolvedCount,
              pending: previous.pendingCount,
              errors: Object.keys(previous.failures).length,
              complete: previous.complete,
            }),
          );
      } catch (e) {
        for (const r of group) previous.failures[r.id] = e.message;
        console.error(e.message);
        save();
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    save();
    console.log(
      JSON.stringify({
        queries,
        resolved: previous.resolvedCount,
        pending: previous.pendingCount,
        errors: Object.keys(previous.failures).length,
        complete: previous.complete,
      }),
    );
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    unlinkSync(lockPath);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await resolveNfts();
