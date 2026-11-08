import { writeFileSync } from "node:fs";
import { createCatalogLoader } from "../src/catalog-bundle.mjs";
import { summarizeBpmCoverage as summarize } from "../src/bpm-coverage.mjs";

const records = createCatalogLoader()().records;
const report = {
  checkedAt: new Date().toISOString(),
  scope:
    "Current local catalog checkpoint, not necessarily published. Displayed BPM follows the app's source-first rules; source and estimated counts are mutually exclusive. Missing includes separately counted deferred transfers, pending, unavailable and needs-review, never forced guesses.",
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
