import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  renameSync,
} from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { createCatalogLoader } from "../src/catalog-bundle.mjs";
import { acquireRecoveryLock } from "../src/recovery-job-lock.mjs";
import {
  extractMusicMetadata,
  MUSIC_METADATA_SCHEMA_VERSION,
} from "../src/extract-music-metadata.mjs";
import {
  hasAdditionalMusicFacts,
  mergeMusicMetadataFacts,
} from "../src/music-metadata-enrichment.mjs";
const endpoint = "https://api.spinamp.xyz/v3/graphql";
const bundle = createCatalogLoader()();
const references = JSON.parse(
  gunzipSync(
    readFileSync(
      process.argv.find((a) => a.startsWith("--references="))?.slice(13) ||
        "data/metadata-enrichment-identities.json.gz",
    ),
  ),
).references;
const file = "data/music-metadata.json",
  cache = "work/indexed-metadata-cache";
const limit = Number(
  process.argv.find((a) => a.startsWith("--limit="))?.slice(8) || 300,
);
if (!Number.isInteger(limit) || limit < 1 || limit > 1000)
  throw Error("limit must be 1–1000");
const cacheOnly = process.argv.includes("--cache-only");
const refresh = process.argv.includes("--refresh");
mkdirSync(cache, { recursive: true });
const hash = (value) => createHash("sha256").update(value).digest("hex");
const read = (p, f) => {
  try {
    return JSON.parse(readFileSync(p));
  } catch {
    return f;
  }
};
const state = read(file, { records: {} }),
  release = acquireRecoveryLock(file);
const checkpointPath = "data/metadata-enrichment-checkpoint.json";
const checkpoint = read(checkpointPath, { records: {} });
const sourcePath = "data/metadata-enrichment-sources.json.gz";
const sourceEvidence = existsSync(sourcePath)
  ? JSON.parse(gunzipSync(readFileSync(sourcePath)))
  : { source: endpoint, nfts: {} };
const report = {
  startedAt: new Date().toISOString(),
  source: endpoint,
  totalCatalogRecords: bundle.records.length,
  scope:
    "Bounded exact-NFT public index reread; not independent blockchain verification",
  cacheOnly,
  limit,
  requested: 0,
  read: 0,
  improved: 0,
  failures: [],
  records: [],
};
let stop = false;
process.once("SIGINT", () => {
  stop = true;
});
process.once("SIGTERM", () => {
  stop = true;
});
const save = () => {
  state.updatedAt = new Date().toISOString();
  state.indexedEnrichment = {
    checkedAt: state.updatedAt,
    report: "data/metadata-enrichment-audit.json",
    independentOnchainVerification: false,
  };
  writeFileSync(file + ".tmp", JSON.stringify(state, null, 2));
  renameSync(file + ".tmp", file);
  writeFileSync(
    "data/metadata-enrichment-audit.json",
    JSON.stringify(report, null, 2),
  );
  writeFileSync(checkpointPath + ".tmp", JSON.stringify(checkpoint, null, 2));
  renameSync(checkpointPath + ".tmp", checkpointPath);
  writeFileSync(sourcePath + ".tmp", gzipSync(JSON.stringify(sourceEvidence)));
  renameSync(sourcePath + ".tmp", sourcePath);
};
const eligible = bundle.records.filter(
  (r) => r.spinampTrackId && references[r.spinampTrackId]?.id,
);
// Diversity first: inspect each collection, then the known structured-credit cohort.
const groups = new Map();
for (const r of eligible) {
  const key = r.platform + "|" + (r.contract || r.platform);
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(r);
}
const platformRows = new Map();
for (const r of eligible) {
  if (!platformRows.has(r.platform)) platformRows.set(r.platform, []);
  platformRows.get(r.platform).push(r);
}
const priority = [...platformRows.values()].flatMap((rows) => rows.slice(0, 2));
priority.push(...eligible.filter((r) => r.platform === "TokenTraxx"));
priority.push(...eligible.filter((r) => r.platform === "Nina").slice(0, 25));
priority.push(...[...groups.values()].flatMap((rows) => rows.slice(0, 2)));
priority.push(...eligible);
const seen = new Set();
const selected = priority
  .filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return (
      refresh ||
      checkpoint.records[r.id]?.schemaVersion !==
        MUSIC_METADATA_SCHEMA_VERSION ||
      checkpoint.records[r.id]?.nftId !== references[r.spinampTrackId].id
    );
  })
  .slice(0, limit);
report.eligibleIndexedRecords = eligible.length;
report.selectedRecords = selected.length;
if (process.argv.includes("--plan")) {
  console.log(
    JSON.stringify({
      selectedRecords: selected.map((r) => r.id),
      eligibleIndexedRecords: eligible.length,
      checkpointedRecords: Object.keys(checkpoint.records).length,
    }),
  );
  release();
  process.exit(0);
}
const baselinePath = `${cache}/baseline.json`;
const baseline = read(baselinePath, {});
for (const r of selected) baseline[r.id] ||= r.musicMetadata || {};
writeFileSync(baselinePath, JSON.stringify(baseline));
const apply = (r, n, checkedAt) => {
  const reference = references[r.spinampTrackId];
  if (
    !n ||
    n.id !== reference.id ||
    !n.metadata ||
    typeof n.metadata !== "object"
  )
    throw Error("Missing exact NFT metadata");
  const parsed = extractMusicMetadata(n.metadata),
    previous = baseline[r.id] || {};
  const improved = hasAdditionalMusicFacts(previous, parsed);
  report.read++;
  checkpoint.records[r.id] = {
    schemaVersion: MUSIC_METADATA_SCHEMA_VERSION,
    nftId: n.id,
    checkedAt,
    metadataSha256: hash(JSON.stringify(n.metadata)),
  };
  sourceEvidence.nfts[n.id] = { nft: n, checkedAt };
  const fields = Object.keys(parsed.details).filter((k) =>
    parsed.details[k].some((v) => !previous.details?.[k]?.includes(v)),
  );
  report.records.push({
    recordId: r.id,
    platform: r.platform,
    nftId: n.id,
    metadataURI: n.tokenMetadataUri || n.tokenUri || null,
    metadataSha256: hash(JSON.stringify(n.metadata)),
    checkedAt,
    improved,
    addedDetails: fields,
    addedBpm: parsed.bpms.filter((v) => !previous.bpms?.includes(v)),
    addedKeys: parsed.keys.filter((v) => !previous.keys?.includes(v)),
    addedCredits: parsed.credits.filter((v) => !previous.credits?.includes(v)),
    addedLyrics:
      parsed.lyrics?.filter(
        (v) => !previous.lyrics?.some((p) => p.text === v.text),
      ).length || 0,
  });
  if (!improved) return;
  report.improved++;
  state.records[r.id] = {
    ...previous,
    ...mergeMusicMetadataFacts(previous, parsed),
    status: "read",
    schemaVersion: MUSIC_METADATA_SCHEMA_VERSION,
    sourceType: "spinamp-indexed-metadata",
    source: endpoint,
    onchainVerified: false,
    checkedAt,
    metadataURL:
      bundle.evidence[r.id]?.metadataURL || previous.metadataURL || null,
    indexedNftId: n.id,
    metadataSha256: hash(JSON.stringify(n.metadata)),
    provenance:
      "Explicit fields in Spinamp indexed NFT metadata; not independently verified onchain",
    ...(previous.source && previous.source !== endpoint
      ? { previousSource: previous.source }
      : {}),
  };
};
try {
  for (let start = 0; start < selected.length && !stop; start += 20) {
    const rows = selected.slice(start, start + 20),
      pending = [];
    for (const r of rows) {
      const p = `${cache}/${hash(references[r.spinampTrackId].id)}.json`;
      const c =
        read(p, null) || sourceEvidence.nfts[references[r.spinampTrackId].id];
      if (c) {
        try {
          apply(r, c.nft, c.checkedAt);
        } catch (e) {
          report.failures.push({ recordId: r.id, error: e.message });
        }
      } else if (!cacheOnly) pending.push({ r, p });
    }
    if (pending.length) {
      const query =
        "{" +
        pending
          .map(
            ({ r }, i) =>
              `n${i}:nftById(id:${JSON.stringify(references[r.spinampTrackId].id)}){id tokenUri tokenMetadataUri metadata}`,
          )
          .join("\n") +
        "}";
      report.requested += pending.length;
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query }),
          signal: AbortSignal.timeout(25000),
        });
        if (!response.ok) throw Error(`HTTP ${response.status}`);
        const json = await response.json();
        if (json.errors?.length) throw Error(json.errors[0].message);
        for (const [{ r, p }, i] of pending.map((x, i) => [x, i])) {
          const nft = json.data?.["n" + i],
            checkedAt = new Date().toISOString();
          try {
            apply(r, nft, checkedAt);
            writeFileSync(
              p,
              JSON.stringify({ nft, checkedAt, source: endpoint }),
            );
          } catch (e) {
            report.failures.push({ recordId: r.id, error: e.message });
          }
        }
      } catch (e) {
        for (const { r } of pending)
          report.failures.push({ recordId: r.id, error: e.message });
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    save();
    console.log(
      JSON.stringify({
        read: report.read,
        improved: report.improved,
        failures: report.failures.length,
        selected: selected.length,
      }),
    );
  }
  report.finishedAt = stop ? null : new Date().toISOString();
  report.interrupted = stop;
  save();
} finally {
  release();
}
