import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { verifyCatalogEthereumRoyalty } from "../src/catalog-ethereum-revenue.mjs";
const input = JSON.parse(
  readFileSync("data/catalog/ethereum-revenue-candidates.json"),
);
const limitArg = process.argv.find((x) => x.startsWith("--limit="));
const limit = Number(limitArg?.split("=")[1] || input.candidates.length);
if (!Number.isInteger(limit) || limit < 1 || limit > input.candidates.length)
  throw Error(`Audit supports 1–${input.candidates.length} source candidates`);
const report = {
  checkedAt: new Date().toISOString(),
  source: input.source,
  snapshotDate: input.snapshotDate,
  sourceCandidates: input.candidates.length,
  attempted: limit,
  verified: [],
  unresolved: [],
  scope:
    "Snapshot-scoped receipt-backed Ethereum royalty audit; no artist-income totals or UI integration",
};
const dir = "data/catalog/ethereum-revenue-evidence";
const provenance = JSON.parse(readFileSync(`${dir}/rpc-provenance.json`));
for (const candidate of input.candidates.slice(0, limit)) {
  try {
    const path = `${dir}/${candidate.transactionHash}.json`;
    if (!existsSync(path)) throw Error("Receipt not recovered; retryable");
    const receipt = JSON.parse(readFileSync(path));
    const payment = verifyCatalogEthereumRoyalty(
      candidate,
      receipt,
      provenance.chainId,
    );
    if (report.verified.some((v) => v.id === payment.id))
      throw Error("Duplicate royalty event candidate");
    report.verified.push(payment);
  } catch (error) {
    report.unresolved.push({
      sourceEventId: candidate.sourceEventId,
      reason: error.message,
    });
  }
}
writeFileSync(
  "data/catalog/ethereum-revenue-audit.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      attempted: report.attempted,
      verified: report.verified.length,
      unresolved: report.unresolved,
    },
    null,
    2,
  ),
);
