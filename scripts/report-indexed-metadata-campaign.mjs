import { readFileSync, writeFileSync, readdirSync } from "node:fs";
const read = (p) => JSON.parse(readFileSync(p));
const checkpoint = read("data/metadata-enrichment-checkpoint.json");
const batches = readdirSync("data/metadata-enrichment-batches")
  .filter((n) => n.endsWith(".json"))
  .map((n) => read(`data/metadata-enrichment-batches/${n}`));
const rows = new Map();
for (const batch of batches.sort((a, b) =>
  a.startedAt.localeCompare(b.startedAt),
))
  for (const row of batch.records) rows.set(row.recordId, row);
const count = (rows) => ({
  records: rows.length,
  improved: rows.filter((r) => r.improved).length,
  addedBpm: rows.filter((r) => r.addedBpm.length).length,
  addedKeys: rows.filter((r) => r.addedKeys.length).length,
  addedCredits: rows.filter((r) => r.addedCredits.length).length,
  addedLyrics: rows.filter((r) => r.addedLyrics).length,
  addedDetails: rows
    .flatMap((r) => r.addedDetails || [])
    .reduce((counts, key) => {
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {}),
});
const campaigns = new Map();
for (const batch of batches) {
  const key = batch.campaignId || "initial-300";
  if (!campaigns.has(key)) campaigns.set(key, new Map());
  for (const row of batch.records) campaigns.get(key).set(row.recordId, row);
}
const platforms = {};
for (const row of rows.values()) (platforms[row.platform] ||= []).push(row);
const report = {
  checkedAt: new Date().toISOString(),
  scope:
    "Exact indexed NFT source metadata re-extraction; fields are source supplied, not independent onchain verification or audio analysis. Counts are additions to each record baseline, not necessarily newly visible values.",
  eligibleIndexedRecords: 27520,
  successfulIdentities: Object.keys(checkpoint.records).length,
  uniqueNftDocuments: new Set(
    Object.values(checkpoint.records).map((r) => r.nftId),
  ).size,
  retryableFailures: Object.values(checkpoint.failures || {}),
  batchReceipts: batches.map((b) => ({
    batchId: b.batchId || b.startedAt,
    campaignId: b.campaignId || "initial-300",
    startedAt: b.startedAt,
    finishedAt: b.finishedAt,
    requested: b.requested,
    read: b.read,
    improved: b.improved,
    failures: b.failures.length,
    stoppedReason: b.stoppedReason || null,
  })),
  uniqueRecords: count([...rows.values()]),
  byCampaign: Object.fromEntries(
    [...campaigns].map(([id, records]) => [id, count([...records.values()])]),
  ),
  byPlatform: Object.fromEntries(
    Object.entries(platforms).map(([p, r]) => [p, count(r)]),
  ),
};
writeFileSync(
  "data/indexed-metadata-campaign-summary.json",
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({
    successfulIdentities: report.successfulIdentities,
    retryableFailures: report.retryableFailures.length,
    uniqueRecords: report.uniqueRecords,
  }),
);
