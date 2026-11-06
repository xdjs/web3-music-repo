import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { encodeAbiParameters, parseAbiParameters } from "viem";
import {
  CATALOG_ETH_ASKS,
  verifyCatalogEthereumRoyalty,
} from "../src/catalog-ethereum-revenue.mjs";
const candidates = JSON.parse(
  readFileSync(
    new URL(
      "../data/catalog/ethereum-revenue-candidates.json",
      import.meta.url,
    ),
  ),
).candidates;
const candidate = candidates[19];
const receipt = JSON.parse(
  readFileSync(
    new URL(
      `../data/catalog/ethereum-revenue-evidence/${candidate.transactionHash}.json`,
      import.meta.url,
    ),
  ),
);
const run = (c = candidate, r = receipt, chain = "0x1") =>
  verifyCatalogEthereumRoyalty(c, r, chain);
const royaltyTopic =
  "0x866e6ef8682ddf5f1025e64dfdb45527077f7be70fa9ef680b7ffd8cf4ab9c50";
const clone = () => structuredClone(receipt);

test("Ethereum royalty derives exact wei from receipt, never floating source amount", () => {
  const value = run({ ...candidate, amount: 1.0000000000000001e30 });
  assert.equal(value.royaltyRaw, "10000000000000000");
  assert.equal(value.grossSaleRaw, "100000000000000000");
  assert.equal(value.emitter, CATALOG_ETH_ASKS);
  assert.match(value.scope, /not net artist income/);
  assert.match(value.settlementScope, /WETH fallback/);
});

test("Ethereum royalty rejects wrong chain, failed receipt and mismatched transaction/block", () => {
  assert.throws(() => run(candidate, receipt, "0x2105"));
  for (const patch of [
    { status: "0x0" },
    { transactionHash: "0x" + "0".repeat(64) },
    { blockNumber: "0x1" },
  ])
    assert.throws(() => run(candidate, { ...receipt, ...patch }));
  assert.throws(() =>
    run({ ...candidate, tokenId: Number(candidate.tokenId) }),
  );
});

test("Ethereum royalty rejects spoofed emitter, wrong recipient and wrong token", () => {
  const r = clone();
  r.logs.find((l) => l.topics[0] === royaltyTopic).address =
    "0x" + "a".repeat(40);
  assert.throws(() => run(candidate, r));
  assert.throws(() => run({ ...candidate, recipient: "0x" + "a".repeat(40) }));
  assert.throws(() => run({ ...candidate, tokenId: "987" }));
});

test("Ethereum royalty rejects removed/foreign logs, duplicates and unsupported sale allocation", () => {
  for (const patch of [
    { removed: true },
    { blockHash: "0x" + "a".repeat(64) },
    { transactionHash: "0x" + "a".repeat(64) },
  ]) {
    const r = clone();
    Object.assign(r.logs[0], patch);
    assert.throws(() => run(candidate, r));
  }
  const r = clone();
  r.logs.push(r.logs[0]);
  assert.throws(() => run(candidate, r));
  const batch = clone();
  const ask = structuredClone(batch.logs.at(-1));
  ask.logIndex = "0xff";
  batch.logs.push(ask);
  assert.throws(() => run(candidate, batch));
});

test("Ethereum royalty requires matching NFT transfer and royalty no greater than sale", () => {
  const r = clone();
  r.logs = r.logs.filter((l) => l.address !== candidate.contract);
  assert.throws(() => run(candidate, r));
  const excessive = clone();
  excessive.logs.find((l) => l.topics[0] === royaltyTopic).data =
    encodeAbiParameters(parseAbiParameters("uint256"), [100000000000000001n]);
  assert.throws(() => run(candidate, excessive));
});

test("Ethereum full candidate cohort verifies all 144 exact receipts without duplicated events", () => {
  const values = candidates.map((c) =>
    run(
      c,
      JSON.parse(
        readFileSync(
          new URL(
            `../data/catalog/ethereum-revenue-evidence/${c.transactionHash}.json`,
            import.meta.url,
          ),
        ),
      ),
    ),
  );
  assert.equal(new Set(values.map((v) => v.id)).size, 144);
  assert.equal(
    values.every((v) => /^\d+$/.test(v.royaltyRaw)),
    true,
  );
});

test("Ethereum royalty rejects unsupported currency and uncorroborated WETH payout", () => {
  for (const currency of [
    "0x" + "b".repeat(40),
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  ]) {
    const r = clone();
    const ask = r.logs.at(-1);
    // Finder, seller, sellerFundsRecipient, currency, fee, price.
    const words = ask.data.slice(2).match(/.{64}/g);
    words[3] = currency.slice(2).padStart(64, "0");
    ask.data = "0x" + words.join("");
    assert.throws(() => run(candidate, r));
  }
});
