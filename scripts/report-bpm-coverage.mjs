import { writeFileSync } from "node:fs";
import { createCatalogLoader } from "../src/catalog-bundle.mjs";
import { musicFacts } from "../src/music-facts.mjs";

const records = createCatalogLoader()().records;
const summarize = (rows) => {
  const summary = {
    recordings: rows.length,
    supplied: 0,
    estimated: 0,
    missing: 0,
    missingByAnalysisState: {},
  };
  for (const record of rows) {
    const supplied = musicFacts({ ...record, audioAnalysis: null }).bpm;
    const displayed = musicFacts(record).bpm;
    if (supplied) summary.supplied++;
    else if (displayed) summary.estimated++;
    else {
      summary.missing++;
      const status = record.audioAnalysis?.status || "not-analyzed";
      summary.missingByAnalysisState[status] =
        (summary.missingByAnalysisState[status] || 0) + 1;
    }
  }
  summary.withBpm = summary.supplied + summary.estimated;
  summary.percentWithBpm = rows.length
    ? Math.round((1000 * summary.withBpm) / rows.length) / 10
    : 0;
  if (summary.withBpm + summary.missing !== rows.length)
    throw Error("BPM coverage does not reconcile");
  return summary;
};
const report = {
  checkedAt: new Date().toISOString(),
  scope:
    "Current local catalog checkpoint, not necessarily published. Displayed BPM follows the app's source-first rules; source and estimated counts are mutually exclusive. Missing includes pending, unavailable and needs-review, never forced guesses.",
  total: summarize(records),
  byPlatform: Object.fromEntries(
    [...new Set(records.map((r) => r.platform || "Unconfirmed"))]
      .sort()
      .map((platform) => [
        platform,
        summarize(
          records.filter((r) => (r.platform || "Unconfirmed") === platform),
        ),
      ]),
  ),
};
writeFileSync(
  "data/bpm-coverage-report.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    { total: report.total, Sound: report.byPlatform.Sound },
    null,
    2,
  ),
);
