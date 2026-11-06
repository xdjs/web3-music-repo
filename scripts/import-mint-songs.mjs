import { readFileSync, mkdirSync, writeFileSync, renameSync } from "node:fs";
import { createHash } from "node:crypto";
import { mintSongsBundle, MINT_SONGS_SNAPSHOT } from "../src/mint-songs.mjs";
import { mintSongsPolygonBundle } from "../src/mint-songs-polygon.mjs";

// Download these two files from the pinned Neume commit, then pass their paths.
// Network failures must not replace a previously recovered snapshot with empty data.
const [metadataPath, callsPath] = process.argv.slice(2);
if (!metadataPath || !callsPath)
  throw Error(
    "Usage: node scripts/import-mint-songs.mjs <metadata.jsonl> <calls.jsonl>",
  );
const input = readFileSync(metadataPath, "utf8"),
  calls = readFileSync(callsPath, "utf8");
if (
  createHash("sha256").update(input).digest("hex") !==
  "4cbcb85df59c67d5b037fdda9a4cec525e0eb57fbce9fb4dc9c33e787d931152"
)
  throw Error(
    "Metadata does not match pinned snapshot; review before importing",
  );
const parse = (text) =>
  text
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
const result = mintSongsBundle(
  parse(input),
  parse(calls),
  new Date().toISOString(),
);
let polygon;
try {
  polygon = JSON.parse(readFileSync("data/mint-songs/polygon-discovery.json"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (polygon) {
  const imported = mintSongsPolygonBundle(polygon);
  result.bundle.records.push(...imported.bundle.records);
  Object.assign(result.bundle.evidence, imported.bundle.evidence);
  Object.assign(result.originals, imported.originals);
  result.bundle.scope =
    "Partial Ethereum V2 snapshot plus bounded Polygon Factory samples; not a complete platform census";
  result.report.polygon = imported.report;
  result.report.totalImportedRecords = result.bundle.records.length;
}
mkdirSync("data/mint-songs", { recursive: true });
for (const [name, value] of Object.entries({
  "archived-media": result.bundle,
  "original-metadata": result.originals,
  report: { ...result.report, snapshotCommit: MINT_SONGS_SNAPSHOT },
})) {
  const path = `data/mint-songs/${name}.json`;
  writeFileSync(path + ".tmp", JSON.stringify(value, null, 2) + "\n");
  renameSync(path + ".tmp", path);
}
console.log(result.report);
