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
export function candidateNftIds(trackId) {
  const [chain, contract, tail, extra] = String(trackId).split("/");
  if (
    extra !== undefined ||
    !["ethereum", "base", "optimism", "polygon", "zora"].includes(chain) ||
    !/^0x[0-9a-f]{40}$/i.test(contract || "")
  )
    return [];
  const token = /^(0|[1-9][0-9]*)$/.test(tail || "") ? tail : "1";
  const id = `${contract}/${token}`;
  return chain === "ethereum" ? [id, `${chain}/${id}`] : [`${chain}/${id}`];
}
export function candidateRelationQuery(trackId, nftId) {
  return `{t0:allNftsProcessedTracks(condition:{processedTrackId:${JSON.stringify(trackId)},nftId:${JSON.stringify(nftId)}},first:1){pageInfo{hasNextPage}nodes{processedTrackId nftId nftByNftId{id chainId contractAddress tokenId tokenUri tokenMetadataUri mimeType createdAtTime createdAtBlockNumber metadata nftFactoryByNftFactoryId{standard}}}}}`;
}
export function applyCandidateResponse(state, trackId, nftId, result) {
  state.failures ||= {};
  const row = result.data?.t0?.nodes?.[0];
  const nft = row?.nftByNftId;
  const fieldId = nft && `${nft.chainId}/${nft.contractAddress}/${nft.tokenId}`;
  const legacyId =
    nft?.chainId === "ethereum" && `${nft.contractAddress}/${nft.tokenId}`;
  if (
    !result.errors?.length &&
    (!row ||
      row.nftId !== nftId ||
      nft?.id !== nftId ||
      (fieldId !== nftId && legacyId !== nftId))
  ) {
    state.failures[trackId] =
      "Candidate NFT has no confirmed exact-track relation; other editions remain unsearched";
    return false;
  }
  if (!applyRepresentativeResponse(state, trackId, result)) return false;
  // The query was restricted to a candidate NFT, so no claim about other editions.
  delete state.relationCounts[trackId];
  state.representativeLookups[trackId] = {
    checkedAt: new Date().toISOString(),
    source: endpoint,
    scope: "exact-track-and-nft-relation",
    nftId,
    totalCount: null,
  };
  return true;
}
// Avoid the index's expensive COUNT(*) for a representative lookup. This does
// not establish an edition count; a nonempty extra page is deliberately left unread.
export function representativeQuery(trackId) {
  return `{t0:allNftsProcessedTracks(condition:{processedTrackId:${JSON.stringify(trackId)}},first:1,orderBy:NATURAL){pageInfo{hasNextPage endCursor} nodes{processedTrackId nftId nftByNftId{id chainId contractAddress tokenId tokenUri tokenMetadataUri mimeType createdAtTime createdAtBlockNumber metadata nftFactoryByNftFactoryId{standard}}}}}`;
}
export function nestedRepresentativeQuery(trackId) {
  return `{processedTrackById(id:${JSON.stringify(trackId)}){id nftsProcessedTracksByProcessedTrackId(first:1){pageInfo{hasNextPage endCursor}nodes{processedTrackId nftId}}}}`;
}
export function representativeNftQuery(nftId) {
  return `{nftById(id:${JSON.stringify(nftId)}){id chainId contractAddress tokenId tokenUri tokenMetadataUri mimeType createdAtTime createdAtBlockNumber metadata nftFactoryByNftFactoryId{standard}}}`;
}
export function combineRepresentativeResponses(
  trackId,
  relationResult,
  nftResult,
) {
  if (relationResult.errors?.length) return { errors: relationResult.errors };
  const track = relationResult.data?.processedTrackById;
  const connection = track?.nftsProcessedTracksByProcessedTrackId;
  if (
    track?.id !== trackId ||
    !Array.isArray(connection?.nodes) ||
    connection.nodes.length > 1 ||
    typeof connection.pageInfo?.hasNextPage !== "boolean"
  )
    return {
      errors: [{ message: "Incomplete or unrelated track relation response" }],
    };
  if (!connection.nodes.length) return { data: { t0: connection } };
  if (nftResult?.errors?.length) return { errors: nftResult.errors };
  const row = connection.nodes[0],
    nft = nftResult?.data?.nftById;
  if (!row.nftId || row.processedTrackId !== trackId || nft?.id !== row.nftId)
    return {
      errors: [{ message: "Independent NFT response identity mismatch" }],
    };
  return {
    data: { t0: { ...connection, nodes: [{ ...row, nftByNftId: nft }] } },
  };
}
export function applyRepresentativeResponse(state, trackId, result) {
  state.failures ||= {};
  state.relationCounts ||= {};
  state.representativeLookups ||= {};
  const item = result.data?.t0;
  const fail = (reason) => {
    state.failures[trackId] = reason;
    return false;
  };
  if (result.errors?.length)
    return fail(result.errors[0].message || "Upstream relation error");
  if (
    !Array.isArray(item?.nodes) ||
    item.nodes.length > 1 ||
    typeof item.pageInfo?.hasNextPage !== "boolean"
  )
    return fail("Incomplete representative relation response");
  if (!item.nodes.length) {
    if (item.pageInfo.hasNextPage)
      return fail("Inconsistent empty relation page");
    state.references[trackId] = null;
    state.relationCounts[trackId] = 0;
  } else {
    const row = item.nodes[0],
      nft = row?.nftByNftId;
    if (
      row?.processedTrackId !== trackId ||
      !row.nftId ||
      row.nftId !== nft?.id ||
      typeof nft.chainId !== "string" ||
      !nft.contractAddress ||
      !nft.tokenId ||
      !nft.metadata ||
      typeof nft.metadata !== "object" ||
      Array.isArray(nft.metadata)
    )
      return fail("Representative relation identity or metadata mismatch");
    state.references[trackId] = compactNft(nft);
    // A single returned NFT is not a total-edition census.
    if (item.pageInfo.hasNextPage) delete state.relationCounts[trackId];
    else state.relationCounts[trackId] = 1;
  }
  state.representativeLookups[trackId] = {
    checkedAt: new Date().toISOString(),
    source: endpoint,
    scope: "exact-track-first-page",
    hasNextPage: item.pageInfo.hasNextPage,
    totalCount: item.pageInfo.hasNextPage ? null : item.nodes.length,
  };
  delete state.failures[trackId];
  return true;
}
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
