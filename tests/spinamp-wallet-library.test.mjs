import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeSpinampWalletPage,
  readSpinampWalletPage,
} from "../src/spinamp-wallet-library.mjs";
const address = "0x1111111111111111111111111111111111111111",
  contract = "0x2222222222222222222222222222222222222222",
  id = "polygon/" + contract + "/16";
const record = {
  id: "song",
  chainId: 137,
  contract,
  tokenId: "1",
  spinampTrackId: "track-a",
  standard: "ERC721",
};
function fixture() {
  return {
    data: {
      allNfts: {
        totalCount: 2,
        pageInfo: { hasNextPage: true, endCursor: "YWJj" },
        nodes: [
          {
            id,
            chainId: "polygon",
            contractAddress: contract,
            tokenId: "16",
            nftFactoryByNftFactoryId: { standard: "erc721" },
            nftsCollectorsByNftId: {
              totalCount: 1,
              pageInfo: { hasNextPage: false },
              nodes: [{ nftId: id, addressId: address, amount: 1 }],
            },
            nftsProcessedTracksByNftId: {
              totalCount: 1,
              pageInfo: { hasNextPage: false },
              nodes: [{ processedTrackByProcessedTrackId: { id: "track-a" } }],
            },
          },
        ],
      },
    },
  };
}
test("explicit index track relation maps sibling editions; shared artist contract alone does not", () => {
  const r = normalizeSpinampWalletPage(fixture(), address, [record]);
  assert.equal(r.items[0].recordId, "song");
  assert.equal(r.items[0].tokenId, "16");
  assert.equal(r.indexFreshness, "unknown");
  assert.equal(r.onchainVerified, false);
  assert.equal(r.totalIndexedNfts, 2);
  assert.ok(r.nextCursor);
  const unmatched = normalizeSpinampWalletPage(fixture(), address, [
    { ...record, spinampTrackId: "other" },
  ]);
  assert.equal(unmatched.items.length, 0);
  assert.equal(unmatched.unmatchedNfts, 1);
});
test("rejects wrong owner, errors, pagination holes, malformed identity and unsafe balance", () => {
  for (const mutate of [
    (f) => (f.errors = [{ message: "timeout" }]),
    (f) =>
      (f.data.allNfts.nodes[0].nftsCollectorsByNftId.nodes[0].addressId =
        contract),
    (f) => (f.data.allNfts.nodes[0].nftsCollectorsByNftId.nodes[0].amount = 2),
    (f) =>
      (f.data.allNfts.nodes[0].nftsCollectorsByNftId.nodes[0].amount =
        Number.MAX_SAFE_INTEGER + 1),
    (f) =>
      (f.data.allNfts.nodes[0].nftsCollectorsByNftId.pageInfo.hasNextPage = true),
    (f) => (f.data.allNfts.nodes[0].contractAddress = address),
    (f) => f.data.allNfts.nodes.push(f.data.allNfts.nodes[0]),
  ]) {
    const f = fixture();
    mutate(f);
    assert.throws(() => normalizeSpinampWalletPage(f, address, [record]));
  }
});
test("wallet-bound cursors, provider failures and empty success are distinct", async () => {
  let calls = 0;
  const fetcher = async () => {
    calls++;
    return { ok: true, text: async () => JSON.stringify(fixture()) };
  };
  const page = await readSpinampWalletPage(
    address,
    null,
    [record],
    new Map(),
    fetcher,
  );
  assert.equal(page.status, "indexed");
  const wrong = await readSpinampWalletPage(
    contract,
    page.nextCursor,
    [record],
    new Map(),
    fetcher,
  );
  assert.equal(wrong.status, "unavailable");
  assert.equal(calls, 1);
  const failure = await readSpinampWalletPage(
    address,
    null,
    [record],
    new Map(),
    async () => {
      throw Error("timeout");
    },
  );
  assert.equal(failure.status, "unavailable");
  assert.equal(failure.retryable, true);
  const empty = fixture();
  empty.data.allNfts = {
    totalCount: 0,
    pageInfo: { hasNextPage: false, endCursor: null },
    nodes: [],
  };
  assert.equal(
    normalizeSpinampWalletPage(empty, address, [record]).status,
    "indexed",
  );
});
test("one NFT may expose multiple explicitly linked recordings without fabricating distinct asset identities", () => {
  const f = fixture(),
    n = f.data.allNfts.nodes[0];
  n.nftsProcessedTracksByNftId.nodes.push({
    processedTrackByProcessedTrackId: { id: "track-b" },
  });
  n.nftsProcessedTracksByNftId.totalCount = 2;
  const r = normalizeSpinampWalletPage(f, address, [
    record,
    { ...record, id: "song2", spinampTrackId: "track-b" },
  ]);
  assert.equal(r.items.length, 2);
  assert.equal(new Set(r.items.map((i) => i.nftId)).size, 1);
  assert.ok(r.items.every((i) => i.sharedAsset));
});
test("partial nested track relations are counted honestly and never cross-contract match a track ID", () => {
  const f = fixture();
  f.data.allNfts.nodes[0].nftsProcessedTracksByNftId.totalCount = 6;
  f.data.allNfts.nodes[0].nftsProcessedTracksByNftId.pageInfo.hasNextPage = true;
  const x = normalizeSpinampWalletPage(f, address, [
    { ...record, contract: address },
  ]);
  assert.equal(x.items.length, 0);
  assert.equal(x.incompleteTrackRelations, 1);
  assert.equal(x.unmatchedNfts, 1);
});
test("successful and failed pages cache briefly, and simultaneous same-page reads share one request", async () => {
  const { createSpinampWalletReader } =
    await import("../src/spinamp-wallet-library.mjs");
  let calls = 0,
    clock = 0;
  const records = [record],
    registry = new Map();
  const read = createSpinampWalletReader(
    async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 5));
      return { ok: true, text: async () => JSON.stringify(fixture()) };
    },
    () => clock,
  );
  await Promise.all([
    read(address, null, records, registry),
    read(address, null, records, registry),
  ]);
  assert.equal(calls, 1);
  await read(address, null, records, registry);
  assert.equal(calls, 1);
  clock = 60001;
  await read(address, null, records, registry);
  assert.equal(calls, 2);
  let failed = 0;
  const no = createSpinampWalletReader(
    async () => {
      failed++;
      throw Error("timeout");
    },
    () => clock,
  );
  await no(address, null, records, registry);
  await no(address, null, records, registry);
  assert.equal(failed, 1);
  clock += 10001;
  await no(address, null, records, registry);
  assert.equal(failed, 2);
});
test("a nonadvancing provider cursor remains a retryable failure", async () => {
  const first = normalizeSpinampWalletPage(fixture(), address, [record]);
  const r = await readSpinampWalletPage(
    address,
    first.nextCursor,
    [record],
    new Map(),
    async () => ({ ok: true, text: async () => JSON.stringify(fixture()) }),
  );
  assert.equal(r.status, "unavailable");
  assert.equal(r.retryable, true);
});
