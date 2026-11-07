import test from "node:test";
import assert from "node:assert/strict";
import {
  applyRepresentativeResponse,
  representativeQuery,
  needsRelationRetry,
} from "../scripts/spinamp-resolve-nfts.mjs";
const id = "base/0x1111111111111111111111111111111111111111/track";
const nft = {
  id: "base/0x1111111111111111111111111111111111111111/1",
  chainId: "base",
  contractAddress: "0x1111111111111111111111111111111111111111",
  tokenId: "1",
  metadata: { name: "Song", animation_url: "ipfs://content" },
};
const result = () => ({
  data: {
    t0: {
      pageInfo: { hasNextPage: true, endCursor: "cursor" },
      nodes: [
        {
          processedTrackId: id,
          nftId: nft.id,
          nftByNftId: structuredClone(nft),
        },
      ],
    },
  },
});
test("count-free exact representative resolves without inventing total editions", () => {
  const s = {
    references: {},
    failures: { [id]: "timeout" },
    relationCounts: { [id]: 999 },
  };
  assert.ok(!representativeQuery(id).includes("totalCount"));
  assert.equal(applyRepresentativeResponse(s, id, result()), true);
  assert.equal(needsRelationRetry(s, id), false);
  assert.equal(s.relationCounts[id], undefined);
  assert.equal(s.representativeLookups[id].totalCount, null);
  assert.equal(s.references[id].metadataTitle, "Song");
});
test("errors and identity mismatches preserve previous reference and stay retryable", () => {
  for (const change of [
    (r) => (r.errors = [{ message: "timeout" }]),
    (r) => (r.data.t0.nodes[0].processedTrackId = "different"),
    (r) => (r.data.t0.nodes[0].nftId = "different"),
    (r) => delete r.data.t0.nodes[0].nftByNftId.metadata,
    (r) => delete r.data.t0.pageInfo,
    (r) => r.data.t0.nodes.push(r.data.t0.nodes[0]),
  ]) {
    const s = { references: { [id]: { sentinel: true } } },
      r = result();
    change(r);
    assert.equal(applyRepresentativeResponse(s, id, r), false);
    assert.deepEqual(s.references[id], { sentinel: true });
    assert.equal(needsRelationRetry(s, id), true);
  }
});
test("only complete empty pages are successful empty results", () => {
  const s = { references: {} };
  const r = { data: { t0: { nodes: [], pageInfo: { hasNextPage: true } } } };
  assert.equal(applyRepresentativeResponse(s, id, r), false);
  assert.equal(Object.hasOwn(s.references, id), false);
  r.data.t0.pageInfo.hasNextPage = false;
  assert.equal(applyRepresentativeResponse(s, id, r), true);
  assert.equal(s.references[id], null);
  assert.equal(s.relationCounts[id], 0);
});

test("separate metadata reads bind exact parent, relation and NFT IDs", async () => {
  const { combineRepresentativeResponses } =
    await import("../scripts/spinamp-resolve-nfts.mjs");
  const relation = {
    data: {
      processedTrackById: {
        id,
        nftsProcessedTracksByProcessedTrackId: {
          pageInfo: { hasNextPage: true },
          nodes: [{ processedTrackId: id, nftId: nft.id }],
        },
      },
    },
  };
  const metadata = { data: { nftById: structuredClone(nft) } };
  const s = { references: {} };
  assert.equal(
    applyRepresentativeResponse(
      s,
      id,
      combineRepresentativeResponses(id, relation, metadata),
    ),
    true,
  );
  for (const mutate of [
    (r) => (r.data.processedTrackById.id = "other"),
    (r) =>
      (r.data.processedTrackById.nftsProcessedTracksByProcessedTrackId.nodes[0].nftId =
        "other"),
    (r) => (r.errors = [{ message: "timeout" }]),
  ]) {
    const r = structuredClone(relation);
    mutate(r);
    assert.ok(combineRepresentativeResponses(id, r, metadata).errors);
  }
  assert.ok(
    combineRepresentativeResponses(id, relation, {
      data: { nftById: { ...nft, id: "other" } },
    }).errors,
  );
  assert.ok(
    combineRepresentativeResponses(id, relation, {
      errors: [{ message: "timeout" }],
    }).errors,
  );
});

test("candidate NFT IDs are search hints only; exact composite relation required, counts stay unknown", async () => {
  const { candidateNftIds, candidateRelationQuery, applyCandidateResponse } =
    await import("../scripts/spinamp-resolve-nfts.mjs");
  assert.deepEqual(candidateNftIds(id), [nft.id]);
  assert.deepEqual(candidateNftIds("solana/mint"), []);
  const s = { references: {} };
  assert.ok(candidateRelationQuery(id, nft.id).includes("nftId:"));
  assert.equal(
    applyCandidateResponse(s, id, nft.id, {
      data: { t0: { nodes: [], pageInfo: { hasNextPage: false } } },
    }),
    false,
  );
  assert.equal(Object.hasOwn(s.references, id), false);
  const r = result();
  r.data.t0.pageInfo.hasNextPage = false;
  assert.equal(applyCandidateResponse(s, id, nft.id, r), true);
  assert.equal(s.relationCounts[id], undefined);
  assert.equal(s.representativeLookups[id].totalCount, null);
  assert.equal(
    s.representativeLookups[id].scope,
    "exact-track-and-nft-relation",
  );
  assert.equal(applyCandidateResponse(s, id, "wrong-NFT", result()), false);
});

test("candidate NFT identifier must agree with its returned chain, contract and token fields", async () => {
  const { applyCandidateResponse } =
    await import("../scripts/spinamp-resolve-nfts.mjs");
  for (const patch of [
    { chainId: "ethereum" },
    { contractAddress: "0x2222222222222222222222222222222222222222" },
    { tokenId: "2" },
  ]) {
    const r = result();
    Object.assign(r.data.t0.nodes[0].nftByNftId, patch);
    const s = { references: {} };
    assert.equal(applyCandidateResponse(s, id, nft.id, r), false);
    assert.equal(Object.hasOwn(s.references, id), false);
  }
});
