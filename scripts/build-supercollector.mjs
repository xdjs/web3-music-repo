import { readFileSync, writeFileSync } from "node:fs";
import { supercollectorBundle } from "../src/supercollector.mjs";
const inventory = JSON.parse(
  readFileSync("data/supercollector/inventory.json"),
);
let audit = null;
try {
  audit = JSON.parse(
    readFileSync("data/supercollector/chain-verification.json"),
  );
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const bundle = supercollectorBundle(
  inventory.releases,
  inventory.checkedAt,
  audit,
);
writeFileSync(
  "data/supercollector/recovered-media.json",
  JSON.stringify(bundle, null, 2) + "\n",
);
console.log(
  "records",
  bundle.records.length,
  "Pete credits",
  bundle.records.filter((r) =>
    r.credits?.some((c) => c.personId === "pete-rango"),
  ).length,
);
const countBy = (values, fn) =>
  values.reduce((out, value) => {
    const key = fn(value);
    out[key] = (out[key] || 0) + 1;
    return out;
  }, {});
writeFileSync(
  "data/supercollector/report.json",
  JSON.stringify(
    {
      checkedAt: inventory.checkedAt,
      indexReleases: inventory.indexReleases,
      indexTracks: inventory.indexTracks,
      directoryArtists: inventory.directoryArtists,
      directoryReleases: inventory.directoryReleases,
      releasePagesRead: inventory.releases.length,
      releasePageFailures: inventory.failures,
      publicRecords: bundle.records.length,
      withheldByReason: countBy(bundle.unresolved, (x) => x.reason),
      chains: countBy(inventory.releases, (x) => x.chainId),
      originalBPMTracks: bundle.records.filter(
        (r) => r.musicMetadata.bpms.length,
      ).length,
      originalKeyTracks: bundle.records.filter(
        (r) => r.musicMetadata.keys.length,
      ).length,
      creditedTracks: bundle.records.filter(
        (r) => r.musicMetadata.credits.length,
      ).length,
      peteAttributedTracks: bundle.records.filter((r) => r.credits.length)
        .length,
      chainAudit: {
        blockNumber: audit?.blockNumber,
        outcomes: countBy(audit?.results || [], (x) => x.status),
      },
      scope: bundle.scope,
    },
    null,
    2,
  ) + "\n",
);
