import { readFileSync, existsSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { createCatalogLoader } from "../src/catalog-bundle.mjs";
import { extractLyrics } from "../src/extract-music-metadata.mjs";
const read = (p, f = {}) => {
  try {
    return JSON.parse(readFileSync(p));
  } catch {
    return f;
  }
};
const bundle = createCatalogLoader()();
const snapshots = {
    ...read("data/catalog/original-metadata.json"),
    ...read("data/catalog/ethereum-original-metadata.json"),
  },
  mint = read("data/mint-songs/original-metadata.json");
const checkpoints = [
  read("data/music-metadata.json").records || {},
  read("../music-nft-recovery/data/music-metadata.json").records || {},
];
const dirs = [
  "../music-nft-recovery/work/music-metadata-cache",
  "work/music-metadata-cache",
];
const records = {},
  report = {
    checkedAt: new Date().toISOString(),
    scope:
      "Offline original metadata extraction; no network calls or active worker writes",
    catalogRecords: bundle.records.length,
    documentsMatched: 0,
    lyricsTracks: 0,
    referenceOnlyTracks: 0,
    oversizedTracks: 0,
    byPlatform: {},
    samples: [],
    cacheFiles: dirs.map((path) => ({
      path,
      count: existsSync(path)
        ? readdirSync(path).filter((f) => f.endsWith(".json")).length
        : 0,
    })),
  };
for (const r of bundle.records) {
  const snapshot =
      snapshots[`${r.chainId}-${r.contract.toLowerCase()}-${r.tokenId}`],
    v = bundle.evidence[r.id];
  const candidates = [
    snapshot?.source,
    ...checkpoints.map((c) => c[r.id]?.source),
    v?.metadataURI,
    v?.metadataURL,
  ].filter((x) => typeof x === "string");
  let metadata = snapshot?.metadata || mint[r.id]?.results,
    source = snapshot?.source || candidates[0],
    provenance = snapshot
      ? "Catalog official metadata snapshot"
      : mint[r.id]
        ? "Neume preserved Mint Songs metadata"
        : null;
  if (!metadata)
    for (const candidate of [...new Set(candidates)]) {
      const key = createHash("sha256").update(candidate).digest("hex");
      for (const dir of dirs) {
        const p = `${dir}/${key}.json`;
        if (existsSync(p)) {
          metadata = read(p, null);
          source = candidate;
          provenance = "Previously fetched original metadata";
          break;
        }
      }
      if (metadata) break;
    }
  const counts = (report.byPlatform[r.platform] ||= {
    records: 0,
    documentsMatched: 0,
    lyricsTracks: 0,
    referenceOnlyTracks: 0,
  });
  counts.records++;
  if (!metadata) continue;
  report.documentsMatched++;
  counts.documentsMatched++;
  const extracted = extractLyrics(metadata);
  if (extracted.lyrics?.length) {
    report.lyricsTracks++;
    counts.lyricsTracks++;
    if (report.samples.length < 10)
      report.samples.push({
        id: r.id,
        title: r.title,
        platform: r.platform,
        versions: extracted.lyrics.length,
      });
  }
  if (extracted.lyricsReferences?.length && !extracted.lyrics?.length) {
    report.referenceOnlyTracks++;
    counts.referenceOnlyTracks++;
  }
  if (extracted.lyricsOmittedReason) report.oversizedTracks++;
  records[r.id] = {
    ...extracted,
    source,
    metadataURL:
      v?.metadataURL ||
      checkpoints.find((c) => c[r.id]?.metadataURL)?.[r.id]?.metadataURL ||
      null,
    provenance,
  };
}
writeFileSync(
  "data/lyrics-recovery.json",
  JSON.stringify(
    { checkedAt: report.checkedAt, scope: report.scope, records },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  "data/lyrics-recovery-audit.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
