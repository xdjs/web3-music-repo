import test from "node:test";
import assert from "node:assert/strict";
import { catalogHolders } from "../src/catalog-holders.mjs";
const contract = "0x" + "1".repeat(40),
  a = "0x" + "2".repeat(40),
  b = "0x" + "3".repeat(40),
  zero = "0x" + "0".repeat(40);
const record = { platform: "Catalog", chainId: 8453, contract, tokenId: "1" };
const transfer = (from, to, amount, tokenId = "1") => ({
  contract,
  tokenId,
  from,
  to,
  amount,
});
const snapshot = {
  snapshotDate: "2026-03-09",
  source: "https://github.com/catalogworks/catalog-squidward-data",
  ethereumOwners: [],
  baseTransfers: [],
  basePurchases: [],
};
test("Catalog balances preserve token scope, transfers and burns, and identify snapshot date", () => {
  const s = {
    ...snapshot,
    baseTransfers: [
      transfer(zero, a, "5"),
      transfer(a, b, "2"),
      transfer(b, zero, "1"),
      transfer(zero, b, "100", "2"),
    ],
  };
  const result = catalogHolders(record, s);
  assert.deepEqual(result.items, [
    { address: a, balance: "3" },
    { address: b, balance: "1" },
  ]);
  assert.equal(result.scope, "catalog-snapshot");
  assert.equal(result.snapshotDate, "2026-03-09");
});
test("incomplete balances and unknown tokens never become successful holder snapshots", () => {
  assert.equal(
    catalogHolders(record, {
      ...snapshot,
      baseTransfers: [transfer(a, b, "2")],
    }),
    null,
  );
  assert.equal(catalogHolders(record, snapshot), null);
  assert.equal(
    catalogHolders({ ...record, platform: "Sound" }, snapshot),
    null,
  );
});
test("Catalog Ethereum ownership is exact-token historical data", () => {
  assert.equal(
    catalogHolders(
      { ...record, chainId: 1 },
      { ...snapshot, ethereumOwners: [{ contract, tokenId: "1", address: a }] },
    ).items[0].address,
    a,
  );
  assert.equal(
    catalogHolders(
      { ...record, chainId: 1, tokenId: "2" },
      { ...snapshot, ethereumOwners: [{ contract, tokenId: "1", address: a }] },
    ),
    null,
  );
});

test("missing mint history falls back to purchase recipients without claiming balances", () => {
  const result = catalogHolders(record, {
    ...snapshot,
    baseTransfers: [transfer(a, b, "1")],
    basePurchases: [
      { contract, tokenId: "1", recipient: a, amount: "2" },
      { contract, tokenId: "2", recipient: b, amount: "9" },
    ],
  });
  assert.equal(result.scope, "catalog-purchases");
  assert.deepEqual(result.items, [{ address: a, balance: "2" }]);
});
