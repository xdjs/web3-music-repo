import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import {
  verifyCatalogPayment,
  summarizePayments,
} from "../src/catalog-revenue.mjs";
const input = JSON.parse(
  readFileSync("data/catalog/purchase-financial-inputs.json"),
);
const configs = JSON.parse(
  readFileSync("data/catalog/payment-config-history.json"),
);
const dir = "evidence/catalog-payments";
mkdirSync(dir, { recursive: true });
const report = {
  source: input.source,
  snapshotDate: input.snapshotDate,
  contractSource:
    "https://github.com/catalogworks/catalog-release-contracts-public/tree/6bcc4fbdc7c3c0ea38f8758cdbd1c7f41a60f472",
  verified: [],
  unavailable: [],
  records: {},
};
const byToken = new Map();
for (const event of input.events) {
  try {
    const config = configs
      .filter(
        (c) =>
          c.token_id === event.cr_token_id &&
          (BigInt(c.updated_at_block_number) <
            BigInt(event.purchased_at_block_number) ||
            (c.updated_at_block_number === event.purchased_at_block_number &&
              c.id < event.id)),
      )
      .sort((a, b) => a.id.localeCompare(b.id))
      .at(-1);
    const path = `${dir}/${event.purchased_at_tx_hash}.json`;
    let receipt;
    if (existsSync(path)) receipt = JSON.parse(readFileSync(path));
    else {
      const response = await fetch("https://base.drpc.org", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getTransactionReceipt",
          params: [event.purchased_at_tx_hash],
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw Error("RPC HTTP " + response.status);
      const body = await response.json();
      if (body.error || !body.result) throw Error("Receipt unavailable");
      receipt = body.result;
      writeFileSync(path, JSON.stringify(receipt, null, 2));
    }
    const payment = verifyCatalogPayment(event, receipt, config);
    const key = event.cr_token_id;
    (byToken.get(key) || byToken.set(key, []).get(key)).push(payment);
    report.verified.push(event.id);
  } catch (e) {
    report.unavailable.push({ id: event.id, reason: e.message });
  }
  if ((report.verified.length + report.unavailable.length) % 20 === 0)
    console.log(
      "CATALOG PAYMENTS",
      report.verified.length,
      "verified",
      report.unavailable.length,
      "unresolved",
    );
  await new Promise((r) => setTimeout(r, 750));
}
report.records = Object.fromEntries(
  [...byToken].map(([key, events]) => [key, summarizePayments(events)]),
);
report.checkedAt = new Date().toISOString();
writeFileSync(
  "data/catalog/song-revenue.json",
  JSON.stringify(report, null, 2),
);
console.log(
  "CATALOG PAYMENTS COMPLETE",
  report.verified.length,
  report.unavailable.length,
  Object.keys(report.records).length,
);
