import test from "node:test";
import assert from "node:assert/strict";
import { reconcileSoundCoverage } from "../src/reconcile-sound-coverage.mjs";
const contract = "0x" + "a".repeat(40);
const input = () => ({
  censuses: [
    { chainId: 1, unit: "release-contract", collections: [{ contract }] },
  ],
  modern: { attempts: { [`1:${contract}`]: { status: "unavailable" } } },
  fallback: { attempts: {} },
  records: [{ id: "song", chainId: 1, contract, tokenId: "2", title: "Song" }],
  evidence: {
    song: {
      chainId: 1,
      contract,
      tokenId: "2",
      mediaURI: "ipfs://source",
      status: "indexed",
    },
  },
});
test("indexed identity reconciles a historical gap without rewriting it as chain or playback verified", () => {
  const x = input();
  const r = reconcileSoundCoverage(x);
  assert.equal(r.historicalUnresolvedNowIndexed, 1);
  assert.equal(r.unresolvedContracts[0].priorStatus, "unavailable");
  assert.equal(r.unresolvedContracts[0].matches[0].playbackVerified, false);
  assert.equal(x.modern.attempts[`1:${contract}`].status, "unavailable");
});
test("same address on another chain or mismatched evidence token cannot fill a gap", () => {
  for (const change of [
    { chainId: 10 },
    { tokenId: "3" },
    { status: "unavailable" },
  ]) {
    const x = input();
    Object.assign(x.evidence.song, change);
    assert.equal(reconcileSoundCoverage(x).historicalUnresolvedNowIndexed, 0);
  }
});
test("census duplicates do not inflate counts and transient fallback cannot erase success", () => {
  const x = input();
  x.censuses.push(x.censuses[0]);
  x.modern.attempts[`1:${contract}`].status = "live";
  x.fallback.attempts[`1:${contract}`] = { status: "unavailable" };
  const r = reconcileSoundCoverage(x);
  assert.equal(r.knownModernReleaseContracts, 1);
  assert.equal(r.historicalUnresolved, 0);
});
