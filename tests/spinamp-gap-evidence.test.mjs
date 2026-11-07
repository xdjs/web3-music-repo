import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { exportGapEvidence } from "../scripts/spinamp-export-gap-evidence.mjs";
const read = (p) =>
  JSON.parse(readFileSync(new URL("../" + p, import.meta.url)));
const evidence = read("data/spinamp/gap-reference-evidence.json"),
  receipt = read("data/spinamp/representative-retry-2026-11-06.json");
function stateFromPublicEvidence() {
  return {
    references: Object.fromEntries(
      evidence.recovered.map((r) => [r.trackId, r.reference]),
    ),
    representativeLookups: Object.fromEntries(
      evidence.recovered.map((r) => [r.trackId, r.representativeLookup]),
    ),
    failures: Object.fromEntries(
      evidence.unresolved.map((r) => [r.trackId, r.reason]),
    ),
  };
}
test("fresh checkout can reconcile all125 recovered references and44 unresolved outcomes without ignored cache", () => {
  const snapshot = exportGapEvidence(stateFromPublicEvidence(), receipt);
  assert.deepEqual(snapshot, evidence);
  assert.equal(snapshot.recoveredCount, 125);
  assert.equal(snapshot.unresolvedCount, 44);
  assert.equal(snapshot.rawGraphQLResponsesRetained, false);
  assert.equal(snapshot.rawMetadataRetained, false);
  assert.equal(snapshot.recoveredCount + snapshot.unresolvedCount, 169);
  for (const r of snapshot.recovered) {
    assert.equal(
      r.sourceQuery.sha256,
      createHash("sha256").update(r.sourceQuery.query).digest("hex"),
    );
    assert.equal(r.representativeLookup.totalCount, null);
    assert.equal(r.onchainVerified, false);
  }
});
test("snapshot exporter refuses mismatched token identity, stale unresolved state and duplicate tracks", () => {
  for (const mutate of [
    (s) => (s.references[evidence.recovered[0].trackId].tokenId = "999999"),
    (s) =>
      (s.representativeLookups[evidence.recovered[0].trackId].nftId =
        "different"),
    (s) =>
      (s.representativeLookups[evidence.recovered[0].trackId].totalCount = 1),
    (s) => delete s.failures[evidence.unresolved[0].trackId],
  ]) {
    const state = structuredClone(stateFromPublicEvidence());
    mutate(state);
    assert.throws(() => exportGapEvidence(state, receipt));
  }
  const duplicate = structuredClone(receipt);
  duplicate.attempts[1] = duplicate.attempts[0];
  assert.throws(() => exportGapEvidence(stateFromPublicEvidence(), duplicate));
});
test("every newly admitted recording retains a matching source metadata digest from the exported cohort", () => {
  const summary = read("data/spinamp/gap-recovery-summary.json"),
    bundle = read("data/spinamp/recovered-media.json"),
    refs = new Map(evidence.recovered.map((r) => [r.trackId, r.reference])),
    records = new Map(bundle.records.map((r) => [r.id, r]));
  for (const id of summary.newRecordIds) {
    const record = records.get(id),
      ref = refs.get(record.spinampTrackId);
    assert.ok(ref, id);
    assert.equal(bundle.evidence[id].metadataSha256, ref.metadataSha256);
    assert.equal(record.contract, ref.contractAddress.toLowerCase());
    assert.equal(String(record.tokenId), ref.tokenId);
  }
});
