import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { acquireRecoveryLock } from "../src/recovery-job-lock.mjs";

// Update only fields recovered from the original cached documents. Keep credits,
// tempo, keys, provenance and the independent audio-analysis checkpoint intact.
const output = "data/music-metadata.json";
const release = acquireRecoveryLock(output);
try {
  const metadata = JSON.parse(readFileSync(output, "utf8"));
  const recovered = JSON.parse(
    readFileSync("data/lyrics-recovery.json", "utf8"),
  );
  const fields = [
    "hasLyrics",
    "lyrics",
    "lyricsReferences",
    "lyricsOmittedReason",
  ];
  let updated = 0;
  let withText = 0;
  for (const [id, source] of Object.entries(recovered.records)) {
    const record = metadata.records[id];
    if (record?.status !== "read") continue;
    for (const field of fields) {
      delete record[field];
      if (source[field] !== undefined) record[field] = source[field];
    }
    record.schemaVersion = 5;
    record.lyricsParsedAt = recovered.checkedAt;
    updated++;
    if (record.lyrics?.length) withText++;
  }
  metadata.updatedAt = new Date().toISOString();
  writeFileSync(output + ".tmp", JSON.stringify(metadata, null, 2) + "\n");
  renameSync(output + ".tmp", output);
  console.log(JSON.stringify({ updated, withText }));
} finally {
  release();
}
