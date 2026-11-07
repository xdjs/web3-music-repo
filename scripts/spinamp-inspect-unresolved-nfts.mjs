// Bounded reverse traversal: exact NFT primary keys, then their explicit track links.
import {
  readFileSync,
  writeFileSync,
  openSync,
  closeSync,
  renameSync,
  unlinkSync,
} from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { applyCandidateResponse } from "./spinamp-resolve-nfts.mjs";
const source = "https://api.spinamp.xyz/v3/graphql";
export function reverseNftQuery(trackId) {
  const [chain, contract] = trackId.split("/");
  if (
    !["base", "optimism"].includes(chain) ||
    !/^0x[0-9a-f]{40}$/i.test(contract || "")
  )
    throw Error("Unsupported bounded reverse-query identity");
  return (
    "{" +
    [0, 1, 2]
      .map(
        (token) =>
          `n${token}:nftById(id:${JSON.stringify(chain + "/" + contract + "/" + token)}){id chainId contractAddress tokenId tokenUri tokenMetadataUri mimeType createdAtTime createdAtBlockNumber metadata nftFactoryByNftFactoryId{standard} nftsProcessedTracksByNftId(first:10){pageInfo{hasNextPage}nodes{nftId processedTrackId}}}`,
      )
      .join("\n") +
    "}"
  );
}
export function inspectReverseResponse(trackId, body) {
  if (body.errors?.length)
    throw Error(body.errors[0].message || "GraphQL error");
  if (
    !body.data ||
    !["n0", "n1", "n2"].every((k) => Object.hasOwn(body.data, k))
  )
    throw Error("Incomplete NFT lookup response");
  const [chain, contract] = trackId.split("/"),
    otherTrackIds = new Set(),
    presentNfts = [],
    matches = [];
  let partial = false;
  for (const token of [0, 1, 2]) {
    const n = body.data["n" + token];
    if (n === null) continue;
    const id = chain + "/" + contract + "/" + token;
    if (
      n?.id !== id ||
      n.chainId !== chain ||
      n.contractAddress !== contract ||
      n.tokenId !== String(token)
    )
      throw Error("Returned NFT identity mismatch");
    const c = n.nftsProcessedTracksByNftId;
    if (
      !Array.isArray(c?.nodes) ||
      c.nodes.length > 10 ||
      typeof c.pageInfo?.hasNextPage !== "boolean"
    )
      throw Error("Incomplete nested track relations");
    presentNfts.push(id);
    partial ||= c.pageInfo.hasNextPage;
    const seen = new Set();
    for (const row of c.nodes) {
      if (
        row.nftId !== id ||
        typeof row.processedTrackId !== "string" ||
        seen.has(row.processedTrackId)
      )
        throw Error("Nested relation identity mismatch");
      seen.add(row.processedTrackId);
      if (row.processedTrackId === trackId) {
        const { nftsProcessedTracksByNftId, ...nft } = n;
        matches.push({ nftId: id, nft });
      } else otherTrackIds.add(row.processedTrackId);
    }
  }
  return { presentNfts, otherTrackIds: [...otherTrackIds], partial, matches };
}
if (process.argv[1]?.endsWith("spinamp-inspect-unresolved-nfts.mjs")) {
  const path = "data/spinamp/nft-references.json.gz",
    lockPath = path + ".lock",
    lock = openSync(lockPath, "wx");
  writeFileSync(lock, String(process.pid));
  closeSync(lock);
  const report = {
    source,
    startedAt: new Date().toISOString(),
    scope:
      "Reverse primary-key reads of NFT0/1/2 and their explicit indexed track links. Missing candidates are not a complete NFT census or proof of an unminted release.",
    maximumRequests: 44,
    rawResponsesRetained: true,
    results: [],
  };
  let stop = false;
  const halt = () => (stop = true);
  process.on("SIGINT", halt);
  process.on("SIGTERM", halt);
  try {
    const state = JSON.parse(gunzipSync(readFileSync(path))),
      ids = Object.keys(state.failures);
    if (ids.length > 44)
      throw Error("Expected bounded remaining cohort of at most44");
    report.pendingBefore = ids.length;
    let failures = 0;
    for (const trackId of ids) {
      if (stop) break;
      const query = reverseNftQuery(trackId),
        receipt = { source, trackId, query };
      try {
        const response = await fetch(source, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query }),
          signal: AbortSignal.timeout(15000),
        });
        receipt.checkedAt = new Date().toISOString();
        receipt.httpStatus = response.status;
        if (!response.ok) throw Error("HTTP " + response.status);
        receipt.body = await response.json();
        const inspected = inspectReverseResponse(trackId, receipt.body);
        Object.assign(receipt, {
          presentNfts: inspected.presentNfts,
          otherTrackIds: inspected.otherTrackIds,
          partial: inspected.partial,
        });
        if (inspected.matches.length) {
          const { nftId, nft } = inspected.matches[0],
            accepted = applyCandidateResponse(state, trackId, nftId, {
              data: {
                t0: {
                  pageInfo: { hasNextPage: false },
                  nodes: [
                    { processedTrackId: trackId, nftId, nftByNftId: nft },
                  ],
                },
              },
            });
          if (!accepted) throw Error(state.failures[trackId]);
          state.representativeLookups[trackId].queryMethod =
            "reverse-nft-relations";
          state.representativeLookups[trackId].rawEvidenceFile =
            "data/spinamp/reverse-reference-audit-2026-11-07.json";
          receipt.status = "resolved";
        } else receipt.status = "unresolved";
        failures = 0;
      } catch (e) {
        receipt.status = "provider-or-validation-error";
        receipt.error = e.message;
        failures++;
      }
      report.results.push(receipt);
      state.updatedAt = new Date().toISOString();
      state.pendingCount = Object.keys(state.failures).length;
      state.resolvedCount = Object.keys(state.references).length;
      state.complete = state.pendingCount === 0;
      writeFileSync(path + ".tmp", gzipSync(JSON.stringify(state)));
      renameSync(path + ".tmp", path);
      report.pendingAfter = state.pendingCount;
      writeFileSync(
        "data/spinamp/reverse-reference-audit-2026-11-07.json",
        JSON.stringify(report, null, 2) + "\n",
      );
      console.log(
        JSON.stringify({
          attempt: report.results.length,
          trackId,
          status: receipt.status,
          presentNfts: receipt.presentNfts?.length,
          otherTrackIds: receipt.otherTrackIds?.length,
          error: receipt.error,
          pending: state.pendingCount,
        }),
      );
      if (failures >= 3) {
        report.stopReason = "Three consecutive provider/validation failures";
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    report.pendingAfter = Object.keys(state.failures).length;
    report.recovered = report.results.filter(
      (r) => r.status === "resolved",
    ).length;
    report.stopReason ||= stop ? "Graceful stop" : "Bounded cohort completed";
  } finally {
    report.finishedAt = new Date().toISOString();
    writeFileSync(
      "data/spinamp/reverse-reference-audit-2026-11-07.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    unlinkSync(lockPath);
    process.off("SIGINT", halt);
    process.off("SIGTERM", halt);
  }
}
