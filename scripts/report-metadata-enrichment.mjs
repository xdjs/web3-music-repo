import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createCatalogLoader } from "../src/catalog-bundle.mjs";
import { musicFacts } from "../src/music-facts.mjs";
const baselineCommit = "af439241866f0d86d747715af2ab6308ef1b61c2";
const before = JSON.parse(
  execFileSync("git", ["show", `${baselineCommit}:data/music-metadata.json`], {
    maxBuffer: 32 * 1024 * 1024,
  }),
);
const baseAnalysis = JSON.parse(
  execFileSync("git", ["show", `${baselineCommit}:data/audio-analysis.json`], {
    maxBuffer: 32 * 1024 * 1024,
  }),
);
const indexed = new Map(
  JSON.parse(readFileSync("data/spinamp/recovered-media.json")).records.map(
    (r) => [r.id, r.musicMetadata],
  ),
);
const bundle = createCatalogLoader()();
const metrics = (records) => {
  const s = {
    records: records.length,
    suppliedBpm: 0,
    suppliedKey: 0,
    structuredBpm: 0,
    structuredKey: 0,
    credits: 0,
    lyrics: 0,
    genres: 0,
  };
  for (const r of records) {
    const m = r.musicMetadata || {},
      f = musicFacts({ ...r, audioAnalysis: null });
    for (const [k, v] of Object.entries({
      suppliedBpm: f.bpm,
      suppliedKey: f.key,
      structuredBpm: m.bpms?.length,
      structuredKey: m.keys?.length,
      credits: m.credits?.length || m.collaborators?.length,
      lyrics: m.lyrics?.length,
      genres: m.details?.Genre?.length,
    }))
      if (v) s[k]++;
  }
  return s;
};
const previous = bundle.records.map((r) => ({
  ...r,
  musicMetadata:
    before.records[r.id]?.status === "read"
      ? before.records[r.id]
      : indexed.get(r.id) || r.musicMetadata,
}));
const baseline = metrics(previous),
  current = metrics(bundle.records);
const analysis = JSON.parse(readFileSync("data/audio-analysis.json"));
const audit = JSON.parse(readFileSync("data/metadata-enrichment-audit.json"));
const royalties = JSON.parse(
  readFileSync("data/catalog/ethereum-revenue-audit.json"),
);
const report = {
  checkedAt: new Date().toISOString(),
  baselineCommit,
  baseline,
  current,
  delta: Object.fromEntries(
    Object.keys(current).map((k) => [k, current[k] - baseline[k]]),
  ),
  sourcePass: {
    eligibleIndexedRecords: audit.eligibleIndexedRecords,
    read: audit.read,
    improved: audit.improved,
    failed: audit.failures.length,
    portableEvidence: "data/metadata-enrichment-sources.json.gz",
    independentOnchainVerification: false,
  },
  analysisPass: {
    engine: analysis.engine,
    records: Object.entries(analysis.records)
      .filter(
        ([id, v]) =>
          !baseAnalysis.records[id] &&
          ["estimated", "needs-review"].includes(v.status),
      )
      .map(([id, v]) => ({ recordId: id, ...v })),
    scope:
      "Ten missing-tempo Nina recordings; full available original referenced media, one download worker and two analysis threads. Estimates may be half/double tempo. Low-confidence result withheld from normal BPM display; no inferred keys.",
  },
  revenue: {
    newlyRecoveredEvents: 0,
    verifiedBasePurchaseEvents: JSON.parse(
      readFileSync("data/catalog/song-revenue.json"),
    ).verified.length,
    baseReleasesWithVerifiedPayouts: bundle.records.filter((r) => r.revenue)
      .length,
    verifiedEthereumRoyaltyEvents: royalties.verified.length,
    ethereumReleasesWithRoyaltyPayments: bundle.records.filter(
      (r) => r.royaltyPayments?.length,
    ).length,
    scope:
      "Existing receipt-verified historical subsets only. Gross sales are not artist income; collaborator split payouts are not personal take-home pay. No all-platform revenue completeness claim.",
  },
  limits: [
    "Full current cohort audited offline; only 300 indexed NFT metadata documents reread in this bounded pass.",
    "Most music lacks source BPM/key; collection marketing was not used to invent per-track values.",
    "Named role maps are source credits, not verified identity matches or payout-wallet ownership.",
    "Dates already have separate indexed/source provenance; no mint timestamp relabelled as original release date.",
  ],
};
writeFileSync(
  "data/metadata-enrichment-summary.json",
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({
    baseline,
    current,
    delta: report.delta,
    analysis: report.analysisPass.records.map((r) => r.status),
    revenue: report.revenue,
  }),
);
