import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { createCatalogLoader } from "../src/catalog-bundle.mjs";
import { acquireRecoveryLock } from "../src/recovery-job-lock.mjs";
import {
  extractMusicMetadata,
  MUSIC_METADATA_SCHEMA_VERSION,
} from "../src/extract-music-metadata.mjs";
import {
  mergeMusicMetadataFacts,
  hasAdditionalMusicFacts,
} from "../src/music-metadata-enrichment.mjs";
const bundle = createCatalogLoader()(),
  path = "data/music-metadata.json",
  release = acquireRecoveryLock(path);
try {
  const state = JSON.parse(readFileSync(path));
  const report = {
    checkedAt: new Date().toISOString(),
    totalCatalogRecords: bundle.records.length,
    scope:
      "Offline extraction of standalone BPM/key lines in preserved source descriptions. No editorial summaries or audio analysis.",
    records: [],
  };
  for (const r of bundle.records) {
    const previous = r.musicMetadata;
    if (previous?.status !== "read") continue;
    const incoming = {
      bpms: [],
      keys: [],
      details: {},
      credits: [],
      collaborators: [],
    };
    for (const description of previous.details?.Description || []) {
      const parsed = extractMusicMetadata({ description });
      incoming.bpms.push(...parsed.bpms);
      incoming.keys.push(...parsed.keys);
    }
    incoming.keys = incoming.keys.filter(
      (k) =>
        !previous.keys?.some(
          (p) =>
            p.toLowerCase().replace(/\s+/g, "") ===
            k.toLowerCase().replace(/\s+/g, ""),
        ),
    );
    if (!hasAdditionalMusicFacts(previous, incoming)) continue;
    state.records[r.id] = {
      ...previous,
      ...mergeMusicMetadataFacts(previous, incoming),
      schemaVersion: MUSIC_METADATA_SCHEMA_VERSION,
      parsedAt: report.checkedAt,
      extraction: "Standalone explicit BPM/key lines in source description",
    };
    report.records.push({
      recordId: r.id,
      platform: r.platform,
      source:
        previous.source ||
        previous.metadataURL ||
        bundle.evidence[r.id]?.metadataURI ||
        null,
      sourceType:
        previous.sourceType || "original-document-or-publisher-snapshot",
      addedBpm: incoming.bpms.filter((b) => !previous.bpms?.includes(b)),
      addedKeys: incoming.keys,
    });
  }
  writeFileSync(path + ".tmp", JSON.stringify(state, null, 2));
  renameSync(path + ".tmp", path);
  writeFileSync(
    "data/metadata-notes-enrichment.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      records: report.records.length,
      bpm: report.records.filter((r) => r.addedBpm.length).length,
      key: report.records.filter((r) => r.addedKeys.length).length,
    }),
  );
} finally {
  release();
}
