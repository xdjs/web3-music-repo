import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  formatRoyaltyAmount,
  renderRoyaltyPayments,
} from "../src/catalog-royalty-ui.mjs";
const payment = JSON.parse(
  readFileSync(
    new URL("../data/catalog/ethereum-revenue-audit.json", import.meta.url),
  ),
).verified.find((event) => event.tokenId === "986");
const esc = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (value) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        value
      ],
  );
const record = (events = [payment]) => ({
  chainId: 1,
  contract: payment.contract,
  tokenId: payment.tokenId,
  royaltyPayments: events,
});

test("royalty UI renders exact recipient payout and sources without adding gross sale", () => {
  const html = renderRoyaltyPayments(record(), esc);
  assert.match(html, /<strong>0\.01 ETH<\/strong>/);
  assert.doesNotMatch(html, /0\.1 ETH|0\.11 ETH/);
  assert.match(html, /1 recorded payout</);
  assert.match(html, /not the artist’s net income/);
  assert.match(html, /ETH or wrapped ETH/);
  assert.ok(
    html.includes(`https://etherscan.io/address/${payment.royaltyRecipient}`),
  );
  assert.ok(
    html.includes(`https://etherscan.io/tx/${payment.transactionHash}`),
  );
});

test("royalty amounts retain all wei precision without floating point", () => {
  assert.equal(
    formatRoyaltyAmount("1000000000000000001"),
    "1.000000000000000001",
  );
  assert.equal(formatRoyaltyAmount("1"), "0.000000000000000001");
  assert.equal(
    formatRoyaltyAmount("9007199254740993000000000000000001"),
    "9007199254740993.000000000000000001",
  );
  for (const input of [1, "1e18", "-1", "1.5", "01", "<script>"])
    assert.throws(() => formatRoyaltyAmount(input));
});

test("royalty UI deduplicates log identity and withholds conflicting duplicate evidence", () => {
  const duplicate = renderRoyaltyPayments(
    record([payment, { ...payment }]),
    esc,
  );
  assert.match(duplicate, /1 recorded payout</);
  assert.doesNotMatch(duplicate, /0\.02 ETH/);
  assert.equal(
    renderRoyaltyPayments(
      record([payment, { ...payment, royaltyRaw: "20000000000000000" }]),
      esc,
    ),
    "",
  );
});

test("royalty UI keeps ETH and WETH amounts separate", () => {
  const weth = {
    ...payment,
    id: `1:${payment.transactionHash}:999`,
    logIndex: "999",
    saleCurrency: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    currencySymbol: "WETH",
    royaltyRaw: "20000000000000000",
  };
  const html = renderRoyaltyPayments(record([payment, weth]), esc);
  assert.match(html, /<strong>0\.01 ETH<\/strong>/);
  assert.match(html, /<strong>0\.02 WETH<\/strong>/);
  assert.doesNotMatch(html, /0\.03/);
});

test("royalty UI drops wrong-token/network/currency/emitter and malformed input", () => {
  for (const patch of [
    { chainId: 8453 },
    { contract: "0x" + "a".repeat(40) },
    { tokenId: "999" },
    { saleCurrency: "0x" + "b".repeat(40) },
    { emitter: "0x" + "c".repeat(40) },
    { decimals: 6 },
    { royaltyRaw: "0" },
    { transactionHash: '\"><img src=x onerror=alert(1)>' },
    { royaltyRecipient: "javascript:alert(1)" },
    { id: "fake" },
  ])
    assert.equal(
      renderRoyaltyPayments(record([{ ...payment, ...patch }]), esc),
      "",
    );
  assert.equal(renderRoyaltyPayments({ ...record(), chainId: 8453 }, esc), "");
  assert.equal(
    renderRoyaltyPayments({ ...record(), royaltyPayments: undefined }, esc),
    "",
  );
});
