import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { collectorSnapshotHoldings } from "../src/collector-snapshot-library.mjs";
const a = "0x1111111111111111111111111111111111111111",
  b = "0x2222222222222222222222222222222222222222",
  contract = "0x3333333333333333333333333333333333333333";
test("Catalog export and purchase evidence stay historical, exact-token scoped and separate from live balances", () => {
  const records = [
    {
      id: "cat",
      platform: "Catalog",
      chainId: 1,
      contract,
      tokenId: "9",
      title: "Song",
      artist: "Artist",
    },
    { id: "base", platform: "Catalog", chainId: 8453, contract, tokenId: "10" },
  ];
  const snapshot = {
    snapshotDate: "2026-03-09",
    source: "https://catalog.works/export",
    ethereumOwners: [{ contract, tokenId: "9", address: a }],
    baseTransfers: [],
    basePurchases: [{ contract, tokenId: "10", recipient: a, amount: "2" }],
  };
  const x = collectorSnapshotHoldings(a, records, {}, snapshot, null);
  assert.equal(x.length, 2);
  assert.equal(x[0].scope, "catalog-snapshot");
  assert.equal(x[1].scope, "catalog-purchases");
  assert.equal(x[1].balance, "2");
  assert.ok(x.every((h) => h.onchainVerified === false));
  assert.deepEqual(
    collectorSnapshotHoldings(b, records, {}, snapshot, null),
    [],
  );
});
test("known Lens snapshot appears without a prior in-session collector page visit", () => {
  const snapshots = JSON.parse(
      readFileSync(
        new URL("../data/spinamp/collector-snapshots.json", import.meta.url),
      ),
    ),
    s = Object.values(snapshots.records)[0];
  const record = {
    id: s.recordId,
    spinampTrackId: s.trackId,
    chainId: s.chainId,
    contract: s.contract,
    standard: "ERC721",
    tokenId: "1",
    title: "Lens record",
  };
  const address =
    s.owners.responses[0].body.data.n0.nftsCollectorsByNftId.nodes[0].addressId;
  const r = collectorSnapshotHoldings(
    address,
    [record],
    { [record.id]: { metadataURI: s.metadataURI } },
    null,
    snapshots,
  );
  assert.equal(r.length, 1);
  assert.equal(r[0].scope, "spinamp-release-snapshot");
  assert.equal(r[0].indexFreshness, "unknown");
  assert.equal(r[0].recordId, record.id);
});
