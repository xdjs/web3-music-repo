import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  verifyCatalogPayment,
  summarizePayments,
  BASE_USDC,
} from "../src/catalog-revenue.mjs";
const json = (p) => JSON.parse(readFileSync(p));
const event = json("data/catalog/purchase-financial-inputs.json").events[0];
const receipt = json(
  `evidence/catalog-payments/${event.purchased_at_tx_hash}.json`,
);
const config = json("data/catalog/payment-config-history.json").find(
  (c) => c.updated_at_tx_hash === event.purchased_at_tx_hash,
);
test("Catalog payment requires the exact purchase and USDC artist transfer; deduplicated totals retain decimals", () => {
  const payment = verifyCatalogPayment(event, receipt, config);
  const s = summarizePayments([payment, payment]);
  assert.equal(s.purchaseCount, 1);
  assert.equal(s.gross, "3.01");
  assert.equal(s.artistPaid, "2.5585");
  assert.equal(s.platformPaid, "0.4515");
});
test("failed receipts, foreign tokens, incorrect payout addresses and other currencies cannot become revenue", () => {
  assert.throws(() =>
    verifyCatalogPayment(event, { ...receipt, status: "0x0" }, config),
  );
  assert.throws(() =>
    verifyCatalogPayment({ ...event, token_id: "999" }, receipt, config),
  );
  assert.throws(() =>
    verifyCatalogPayment(event, receipt, {
      ...config,
      token_payout_address: "0x" + "1".repeat(40),
    }),
  );
  assert.throws(() =>
    verifyCatalogPayment(
      event,
      {
        ...receipt,
        logs: receipt.logs.filter((l) => l.address.toLowerCase() !== BASE_USDC),
      },
      config,
    ),
  );
  assert.throws(() =>
    verifyCatalogPayment(
      { ...event, value_received_by_artist: "1" },
      receipt,
      config,
    ),
  );
  assert.throws(() =>
    verifyCatalogPayment({ ...event, chain_id: "84532" }, receipt, config),
  );
});
