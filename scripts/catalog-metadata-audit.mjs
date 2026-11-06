import { readFileSync, writeFileSync } from "node:fs";
import { createCatalogLoader } from "../src/catalog-bundle.mjs";
import { extractMusicMetadata } from "../src/extract-music-metadata.mjs";
import { musicFacts } from "../src/music-facts.mjs";

const read = (path) => JSON.parse(readFileSync(path));
const snapshots = {
  ...read("data/catalog/original-metadata.json"),
  ...read("data/catalog/ethereum-original-metadata.json"),
};
const bundle = createCatalogLoader()();
const report = {
  checkedAt: new Date().toISOString(),
  snapshotDate: "2026-03-09",
  source: "https://github.com/catalogworks/catalog-squidward-data",
  scope: "Offline original JSON audit of currently imported Catalog records; not a platform completeness or current URI verification claim",
  originalDocuments: Object.keys(snapshots).length,
  appRecords: 0,
  snapshotMatched: 0,
  snapshotMissing: [],
  structuredBpm: 0,
  structuredKey: 0,
  structuredCredits: 0,
  strictBpmIncludingNotes: 0,
  strictKeyIncludingNotes: 0,
  fields: {},
  nestedProjectTitles: 0,
  creditLanguageCandidates: 0,
  byChain: {},
};
for (const record of bundle.records.filter((r) => r.platform === "Catalog")) {
  report.appRecords++;
  const snapshot = snapshots[`${record.chainId}-${record.contract.toLowerCase()}-${record.tokenId}`];
  const chain = (report.byChain[record.chainId] ||= { appRecords: 0, snapshotMatched: 0 });
  chain.appRecords++;
  if (!snapshot) {
    report.snapshotMissing.push(record.id);
    continue;
  }
  report.snapshotMatched++;
  chain.snapshotMatched++;
  const original = extractMusicMetadata(snapshot.metadata);
  const facts = musicFacts({ ...record, musicMetadata: original, audioAnalysis: null });
  report.structuredBpm += Number(original.bpms.length > 0);
  report.structuredKey += Number(original.keys.length > 0);
  report.structuredCredits += Number(original.credits.length > 0 || original.collaborators.length > 0);
  report.strictBpmIncludingNotes += Number(Boolean(facts.bpm));
  report.strictKeyIncludingNotes += Number(Boolean(facts.key));
  for (const field of Object.keys(original.details)) report.fields[field] = (report.fields[field] || 0) + 1;
  report.nestedProjectTitles += Number(typeof snapshot.metadata.project?.title === "string" && Boolean(snapshot.metadata.project.title.trim()));
  // Discovery candidates only: prose can describe other tracks or an entire album.
  const text = [snapshot.metadata.description, snapshot.metadata.body?.notes].filter(Boolean).join("\n");
  report.creditLanguageCandidates += Number(/(?:produced|written|mixed|mastered|vocals|guitar|drums|artwork)\s*(?:&|and|,|\/|by|:)/i.test(text));
}
writeFileSync("data/catalog/catalog-metadata-audit.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
