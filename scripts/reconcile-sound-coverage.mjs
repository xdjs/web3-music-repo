import fs from "node:fs";
import { createCatalogLoader } from "../src/catalog-bundle.mjs";
import { reconcileSoundCoverage } from "../src/reconcile-sound-coverage.mjs";
const read = (path) => JSON.parse(fs.readFileSync(path));
const files = ["0-1", "1-1", "2-1", "1-10", "2-10"];
const catalog = createCatalogLoader()();
const report = {
  checkedAt: new Date().toISOString(),
  catalogRecords: catalog.records.length,
  censusFiles: files.map((f) => `data/census/${f}.json`),
  ...reconcileSoundCoverage({
    censuses: files.map((f) => read(`data/census/${f}.json`)),
    modern: read("data/sound-expanded.json"),
    fallback: read("data/sound-fallback.json"),
    ...catalog,
  }),
};
fs.writeFileSync(
  "data/sound-resolution/catalog-reconciliation.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      ...report,
      unresolvedContracts: `${report.unresolvedContracts.length} rows saved`,
    },
    null,
    2,
  ),
);
