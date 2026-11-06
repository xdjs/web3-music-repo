import { writeFileSync, readFileSync } from "node:fs";
import { createCatalogLoader } from "../src/catalog-bundle.mjs";
import { musicFacts } from "../src/music-facts.mjs";
const bundle = createCatalogLoader()();
const read = (p, f) => {
  try {
    return JSON.parse(readFileSync(p));
  } catch {
    return f;
  }
};
const metadata = read("data/music-metadata.json", { records: {} }),
  analysis = read("data/audio-analysis.json", { records: {} }),
  payments = read("data/catalog/song-revenue.json", {
    verified: [],
    unavailable: [],
    records: {},
  });
const report = {
  checkedAt: new Date().toISOString(),
  totalRecords: bundle.records.length,
  originalBpm: 0,
  originalKey: 0,
  credits: 0,
  details: {},
  metadataRead: 0,
  metadataUnresolved: 0,
  bpmAnalysis: {},
  payments: {
    verifiedPurchases: payments.verified.length,
    unresolvedPurchases: payments.unavailable.length,
    releasesWithVerifiedPayments: 0,
  },
  byPlatform: {},
  jobs: Object.fromEntries(
    Object.entries({ metadata, bpm: analysis }).map(([name, job]) => [
      name,
      {
        startedAt: job.startedAt || null,
        updatedAt: job.updatedAt || null,
        finishedAt: job.finishedAt || null,
        interruptedAt: job.interruptedAt || null,
        completion: job.finishedAt ? "pass-finished" : "not-confirmed-finished",
        note: "A checkpoint is not proof that a process is alive; failed items remain unresolved even after a pass finishes.",
      },
    ]),
  ),
};
for (const r of bundle.records) {
  const facts = musicFacts({ ...r, audioAnalysis: null });
  const stats = (report.byPlatform[r.platform] ||= {
    records: 0,
    originalBpm: 0,
    originalKey: 0,
    credits: 0,
    metadataRead: 0,
    metadataUnresolved: 0,
    metadataStates: {},
    attributedCredits: 0,
  });
  stats.records++;
  if (facts.bpm) {
    report.originalBpm++;
    stats.originalBpm++;
  }
  if (facts.key) {
    report.originalKey++;
    stats.originalKey++;
  }
  if (
    r.musicMetadata?.credits?.length ||
    r.musicMetadata?.collaborators?.length
  ) {
    report.credits++;
    stats.credits++;
  }
  for (const k of Object.keys(r.musicMetadata?.details || {}))
    report.details[k] = (report.details[k] || 0) + 1;
  const metadataState =
    metadata.records[r.id]?.status ||
    r.musicMetadata?.status ||
    "not-attempted";
  stats.metadataStates[metadataState] =
    (stats.metadataStates[metadataState] || 0) + 1;
  if (metadataState === "read") {
    report.metadataRead++;
    stats.metadataRead++;
  } else {
    report.metadataUnresolved++;
    stats.metadataUnresolved++;
  }
  if (r.credits?.length) stats.attributedCredits++;
  if (r.revenue) report.payments.releasesWithVerifiedPayments++;
  const state = analysis.records[r.id]?.status || "not-queued";
  report.bpmAnalysis[state] = (report.bpmAnalysis[state] || 0) + 1;
}
writeFileSync("data/enrichment-report.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
