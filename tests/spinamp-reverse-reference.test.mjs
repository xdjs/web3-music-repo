import test from "node:test";
import assert from "node:assert/strict";
import {
  inspectReverseResponse,
  reverseNftQuery,
} from "../scripts/spinamp-inspect-unresolved-nfts.mjs";
const track = "optimism/0x1111111111111111111111111111111111111111/hash",
  nft = "optimism/0x1111111111111111111111111111111111111111/2";
const fixture = () => ({
  data: {
    n0: null,
    n1: null,
    n2: {
      id: nft,
      chainId: "optimism",
      contractAddress: "0x1111111111111111111111111111111111111111",
      tokenId: "2",
      metadata: { name: "Original" },
      nftsProcessedTracksByNftId: {
        pageInfo: { hasNextPage: false },
        nodes: [{ nftId: nft, processedTrackId: track }],
      },
    },
  },
});
test("reverse NFT lookup accepts only explicit matching track links and keeps unseen editions outside its scope", () => {
  const r = inspectReverseResponse(track, fixture());
  assert.equal(r.matches.length, 1);
  assert.equal(r.matches[0].nftId, nft);
  assert.ok(reverseNftQuery(track).includes("first:10"));
  const different = fixture();
  different.data.n2.nftsProcessedTracksByNftId.nodes[0].processedTrackId =
    "other";
  const result = inspectReverseResponse(track, different);
  assert.equal(result.matches.length, 0);
  assert.deepEqual(result.otherTrackIds, ["other"]);
});
test("unavailable, incomplete and cross-token/cross-chain responses never become empty success", () => {
  for (const mutate of [
    (r) => (r.errors = [{ message: "timeout" }]),
    (r) => delete r.data.n0,
    (r) => (r.data.n2.chainId = "base"),
    (r) => (r.data.n2.tokenId = "1"),
    (r) => (r.data.n2.nftsProcessedTracksByNftId.nodes[0].nftId = "other"),
    (r) => delete r.data.n2.nftsProcessedTracksByNftId.pageInfo,
  ]) {
    const r = fixture();
    mutate(r);
    assert.throws(() => inspectReverseResponse(track, r));
  }
});
test("unobserved tokens and partial relation pages retain a bounded distinction", () => {
  assert.deepEqual(
    inspectReverseResponse(track, { data: { n0: null, n1: null, n2: null } })
      .presentNfts,
    [],
  );
  const r = fixture();
  r.data.n2.nftsProcessedTracksByNftId.pageInfo.hasNextPage = true;
  assert.equal(inspectReverseResponse(track, r).partial, true);
  assert.equal(inspectReverseResponse(track, r).matches.length, 1);
});

test("tracked raw44-query evidence reconciles the two exact recoveries and42 unresolved tracks", async () => {
  const { readFileSync } = await import("node:fs");
  const read = (p) =>
    JSON.parse(readFileSync(new URL("../" + p, import.meta.url)));
  const raw = read("data/spinamp/reverse-reference-audit-2026-11-07.json"),
    summary = read("data/spinamp/remaining-gaps-audit-2026-11-07.json");
  assert.equal(raw.results.length, 44);
  let matches = 0;
  for (const row of raw.results) {
    assert.equal(row.source, "https://api.spinamp.xyz/v3/graphql");
    assert.equal(row.query, reverseNftQuery(row.trackId));
    const result = inspectReverseResponse(row.trackId, row.body);
    assert.equal(row.status === "resolved", result.matches.length > 0);
    if (result.matches.length) matches++;
  }
  assert.equal(matches, 2);
  assert.equal(summary.pendingAfter, 42);
  assert.equal(summary.newListeningRecords, 0);
  assert.equal(summary.collectorTotalEditions, 1099);
  assert.equal(summary.soundSubsetOverlapPrior44, 0);
});
