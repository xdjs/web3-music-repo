import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { createCatalogLoader } from "../src/catalog-bundle.mjs";
import {
  buildUnlinkedBundle,
  indexedAudioReferences,
  unlinkedImportBaseline,
} from "../src/spinamp-unlinked-release.mjs";
const read = (p) => JSON.parse(readFileSync(p));
const compressed = (p) => JSON.parse(gunzipSync(readFileSync(p)));
const inputPath = "data/spinamp/unlinked-release-inputs.json.gz";
const existing = unlinkedImportBaseline(createCatalogLoader()());
if (process.argv.includes("--prepare")) {
  const inv = compressed("data/spinamp/inventory.json.gz"),
    refs = compressed("data/spinamp/nft-references.json.gz"),
    audit = compressed("data/spinamp/import-audit.json.gz");
  const tracks = inv.records.filter(
    (t) =>
      Object.hasOwn(refs.references, t.id) && refs.references[t.id] === null,
  );
  const trackMap = new Map(inv.records.map((t) => [t.id, t]));
  const pairs = existing.records
    .filter((r) => r.spinampTrackId)
    .map((r) => ({ id: r.spinampTrackId, existingId: r.id }))
    .concat(audit.duplicates);
  const existingIds = new Set(existing.records.map((r) => r.id));
  const seen = new Set();
  const existingProcessedMedia = [];
  for (const pair of pairs) {
    const track = trackMap.get(pair.id);
    if (!track || !existingIds.has(pair.existingId) || seen.has(pair.id))
      continue;
    seen.add(pair.id);
    existingProcessedMedia.push({
      recordId: pair.existingId,
      trackId: pair.id,
      artistId: track.artistId,
      audioReferences: indexedAudioReferences(track),
    });
  }
  const artistIds = new Set(tracks.map((t) => t.artistId));
  const artists = existsSync("data/spinamp/artists.json.gz")
    ? compressed("data/spinamp/artists.json.gz").artists
    : [];
  const input = {
    source: inv.source,
    inventoryFinishedAt: inv.finishedAt,
    scope:
      "Derived public snapshot: original frozen processed-track rows with cached null NFT representatives, plus exact existing-track media and public portrait references. Historic nulls without retained counts are not proof of absent mints.",
    inventorySha256: createHash("sha256")
      .update(readFileSync("data/spinamp/inventory.json.gz"))
      .digest("hex"),
    tracks,
    artistProfiles: artists
      .filter((a) => artistIds.has(a.id) && a.avatarIpfsHash)
      .map((a) => ({ id: a.id, avatarIpfsHash: a.avatarIpfsHash })),
    existingProcessedMedia,
    nullEvidence: {
      total: tracks.length,
      recordedZeroCount: tracks.filter((t) => refs.relationCounts?.[t.id] === 0)
        .length,
      withoutRecordedCount: tracks.filter(
        (t) => !Object.hasOwn(refs.relationCounts || {}, t.id),
      ).length,
    },
  };
  writeFileSync(inputPath, gzipSync(JSON.stringify(input)));
}
const input = compressed(inputPath),
  schema = read("data/spinamp/schema-and-counts.json");
const names = Object.fromEntries(
  schema.body.data.allPlatforms.nodes.map((p) => [p.id, p.name]),
);
names.sound = "Sound";
names.zora = "Zora";
const observationFile = "data/spinamp/unlinked-release-media-verification.json";
const verification = existsSync(observationFile)
  ? read(observationFile)
  : { results: [] };
const observations = verification.results.map((row) => ({
  ...row,
  checkedAt: verification.checkedAt,
  evidenceFile: observationFile,
}));
const { bundle, audit } = buildUnlinkedBundle(
  input,
  existing,
  names,
  observations,
);
const output =
  process.env.SPINAMP_UNLINKED_OUTPUT_DIR || "work/spinamp-unlinked-candidate";
mkdirSync(output, { recursive: true });
writeFileSync(output + "/recovered-media.json", JSON.stringify(bundle) + "\n");
writeFileSync(output + "/import-audit.json", JSON.stringify(audit, null, 2));
writeFileSync(
  "data/spinamp/unlinked-release-audit.json.gz",
  gzipSync(JSON.stringify(audit)),
);
const summary = {
  ...audit,
  excluded: undefined,
  duplicates: undefined,
  excludedCount: audit.excluded.length,
  duplicateCount: audit.duplicates.length,
  bytes: Buffer.byteLength(JSON.stringify(bundle)),
  inputBytes: readFileSync(inputPath).length,
  checkedAt: new Date().toISOString(),
  existingRecords: existing.records.length,
  totalAfterCandidate: existing.records.length + bundle.records.length,
  scope: bundle.scope,
};
writeFileSync(
  "data/spinamp/unlinked-release-summary.json",
  JSON.stringify(summary, null, 2),
);
console.log(JSON.stringify(summary));
