import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeSpinampCollectorSnapshot,
  readSpinampCollectorSnapshot,
} from "../src/spinamp-collectors.mjs";
import { readCollectors } from "../src/recovery-collectors.mjs";
const snapshots = JSON.parse(
  readFileSync(
    new URL("../data/spinamp/collector-snapshots.json", import.meta.url),
  ),
);
const fixture = Object.values(snapshots.records)[0];
const record = {
  id: fixture.recordId,
  spinampTrackId: fixture.trackId,
  chainId: fixture.chainId,
  contract: fixture.contract,
  tokenId: "1",
  standard: "ERC721",
  collectorMetadataURI: fixture.metadataURI,
};

test("exact Lens index evidence maps 16 editions to 13 distinct wallets without a fresh-chain claim", () => {
  const r = normalizeSpinampCollectorSnapshot(fixture);
  assert.equal(r.items.length, 13);
  assert.equal(r.mappedTokenCount, 16);
  assert.equal(
    r.items.reduce((s, h) => s + BigInt(h.balance), 0n),
    16n,
  );
  assert.equal(new Set(r.items.flatMap((h) => h.tokenIds)).size, 16);
  assert.equal(r.indexFreshness, "unknown");
  assert.equal(r.onchainVerified, false);
  assert.equal(r.scope, "spinamp-release-snapshot");
});
test("rejects partial, failed, duplicate, unrelated, and conflicting ownership evidence", () => {
  const mutations = [
    (e) => (e.relations.body.errors = [{ message: "timeout" }]),
    (e) => (e.relations.body.data.relations.pageInfo.hasNextPage = true),
    (e) => e.relations.body.data.relations.nodes.pop(),
    (e) => e.owners.responses.pop(),
    (e) => (e.owners.responses[0].body.errors = [{ message: "timeout" }]),
    (e) => (e.owners.responses[0].body.data.n0.tokenUri = "ipfs://unrelated"),
    (e) =>
      (e.owners.responses[0].body.data.n0.nftsCollectorsByNftId.pageInfo.hasNextPage = true),
    (e) =>
      (e.owners.responses[0].body.data.n0.nftsCollectorsByNftId.nodes[0].amount =
        -1),
    (e) =>
      (e.owners.responses[0].body.data.n0.nftsCollectorsByNftId.nodes[0].nftId =
        "other"),
    (e) => {
      const c = e.owners.responses[0].body.data.n0.nftsCollectorsByNftId;
      c.nodes.push({
        ...c.nodes[0],
        addressId: "0x1111111111111111111111111111111111111111",
      });
      c.totalCount = 2;
    },
    (e) => e.owners.responses.push(e.owners.responses[0]),
    (e) => (e.trackId = "different track"),
  ];
  for (const mutate of mutations) {
    const e = structuredClone(fixture);
    mutate(e);
    assert.throws(() => normalizeSpinampCollectorSnapshot(e));
  }
});
test("snapshot reader binds exact recording and metadata; it cannot spread to adjacent songs", async () => {
  assert.equal(
    readSpinampCollectorSnapshot(record, snapshots, {
      metadataURI: fixture.metadataURI,
    }).items.length,
    13,
  );
  for (const patch of [
    { id: "other" },
    { chainId: 1 },
    { spinampTrackId: "other" },
    { contract: "0x1111111111111111111111111111111111111111" },
    { standard: "ERC1155" },
  ])
    assert.equal(
      readSpinampCollectorSnapshot({ ...record, ...patch }, snapshots, {
        metadataURI: fixture.metadataURI,
      }),
      null,
    );
  assert.equal(
    readSpinampCollectorSnapshot(record, snapshots, {
      metadataURI: "ipfs://other",
    }),
    null,
  );
  const r = await readCollectors(record, null, new Map(), {
    readOwner() {
      throw Error("must not query representative owner");
    },
  });
  assert.equal(r.items.length, 13);
  assert.equal(r.scope, "spinamp-release-snapshot");
});
