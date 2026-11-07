// Export only the explicitly attempted cohort. No API calls or catalog changes.
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { candidateRelationQuery } from "./spinamp-resolve-nfts.mjs";
const source = "https://api.spinamp.xyz/v3/graphql";
const requireThat = (ok, message) => {
  if (!ok) throw Error("Invalid recovery evidence export: " + message);
};
export function exportGapEvidence(state, receipt) {
  requireThat(
    receipt.endpoint === source &&
      Array.isArray(receipt.attempts) &&
      receipt.attempts.length > 0 &&
      receipt.attempts.length <= 169,
    "bounded source cohort",
  );
  requireThat(
    typeof receipt.finishedAt === "string" &&
      Number.isFinite(Date.parse(receipt.finishedAt)),
    "completed receipt",
  );
  const seen = new Set(),
    recovered = [],
    unresolved = [];
  for (const attempt of receipt.attempts) {
    const trackId = attempt.id;
    requireThat(
      typeof trackId === "string" && !seen.has(trackId),
      "duplicate/invalid track",
    );
    seen.add(trackId);
    if (attempt.status === "resolved") {
      const reference = state.references?.[trackId],
        lookup = state.representativeLookups?.[trackId];
      requireThat(
        reference &&
          lookup?.source === source &&
          lookup.scope === "exact-track-and-nft-relation" &&
          lookup.nftId === reference.id &&
          lookup.totalCount === null &&
          !state.failures?.[trackId],
        "resolved reference/lookup",
      );
      const fieldId = `${reference.chainId}/${reference.contractAddress}/${reference.tokenId}`,
        legacyId =
          reference.chainId === "ethereum"
            ? `${reference.contractAddress}/${reference.tokenId}`
            : null;
      requireThat(
        reference.id === fieldId || reference.id === legacyId,
        "NFT field identity",
      );
      requireThat(
        reference.musicMetadata &&
          /^[0-9a-f]{64}$/.test(reference.metadataSha256 || "") &&
          Number.isFinite(Date.parse(lookup.checkedAt)),
        "metadata digest/timestamp",
      );
      requireThat(
        !Object.hasOwn(reference, "metadata"),
        "unexpected raw metadata",
      );
      const query = candidateRelationQuery(trackId, lookup.nftId);
      recovered.push({
        trackId,
        platformId: attempt.platform,
        status: "indexed",
        onchainVerified: false,
        reference,
        representativeLookup: lookup,
        sourceQuery: {
          kind: "reconstructed-from-validated-query-identities",
          query,
          sha256: createHash("sha256").update(query).digest("hex"),
        },
      });
    } else if (attempt.status === "unresolved") {
      requireThat(
        typeof attempt.error === "string" &&
          attempt.error.length > 0 &&
          state.failures?.[trackId] === attempt.error,
        "unresolved reason/state",
      );
      unresolved.push({
        trackId,
        platformId: attempt.platform,
        status: "unresolved",
        reason: attempt.error,
        emptyResult: false,
      });
    } else
      throw Error(
        "Unexpected outcome in exact-candidate cohort: " + attempt.status,
      );
  }
  requireThat(
    recovered.length === receipt.resolvedThisRun &&
      unresolved.length === receipt.pendingAfter &&
      receipt.pendingBefore - recovered.length === receipt.pendingAfter,
    "receipt count reconciliation",
  );
  return {
    schemaVersion: 1,
    source,
    evidenceType: "validated-derived-index-snapshot",
    rawGraphQLResponsesRetained: false,
    rawMetadataRetained: false,
    scope:
      "Compact references and validated lookup identities from the bounded 169-track retry. Queries are reconstructed from the recorded identities, not retained raw network transcripts. Metadata digests refer to original metadata parsed at retrieval; original metadata bytes are not included. No fresh chain, playback, full-edition or index-freshness claim.",
    sourceReceipt: "data/spinamp/representative-retry-2026-11-06.json",
    sourceRunStartedAt: receipt.startedAt,
    sourceRunFinishedAt: receipt.finishedAt,
    inventoryCount: 52987,
    attempted: receipt.attempts.length,
    recoveredCount: recovered.length,
    unresolvedCount: unresolved.length,
    recovered,
    unresolved,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const state = JSON.parse(
      gunzipSync(readFileSync("data/spinamp/nft-references.json.gz")),
    ),
    receipt = JSON.parse(
      readFileSync("data/spinamp/representative-retry-2026-11-06.json"),
    ),
    snapshot = exportGapEvidence(state, receipt),
    text = JSON.stringify(snapshot, null, 2) + "\n";
  writeFileSync("data/spinamp/gap-reference-evidence.json", text);
  console.log(
    JSON.stringify({
      recovered: snapshot.recoveredCount,
      unresolved: snapshot.unresolvedCount,
      bytes: Buffer.byteLength(text),
      sha256: createHash("sha256").update(text).digest("hex"),
    }),
  );
}
