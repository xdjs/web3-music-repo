import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { createCatalogLoader } from "../src/catalog-bundle.mjs";
import {
  applyTrackEnrichment,
  indexedContentKey,
} from "../src/spinamp-track-enrichment.mjs";
import {
  TRACK_METADATA_QUERY,
  validateTrackMetadataPage,
} from "../src/spinamp-track-metadata.mjs";
const directory = "data/spinamp/processed-track-metadata";
const read = (path) => JSON.parse(readFileSync(path));
const unzip = (path) => JSON.parse(gunzipSync(readFileSync(path)));
const hash = (value) => createHash("sha256").update(value).digest("hex");
const checkpoint = read(directory + "/checkpoint.json");
if (!checkpoint.complete || checkpoint.frozenMatched !== 52987)
  throw Error("Source capture incomplete");
const snapshotBytes = readFileSync(directory + "/identity-snapshot.json.gz");
if (hash(snapshotBytes) !== checkpoint.snapshotSha256)
  throw Error("Snapshot hash changed");
const snapshot = new Map(
  JSON.parse(gunzipSync(snapshotBytes)).records.map((row) => [row.id, row]),
);
const catalog = createCatalogLoader({ trackEnrichment: false })();
const byTrack = new Map(
  catalog.records
    .filter((r) => r.spinampTrackId)
    .map((r) => [r.spinampTrackId, r]),
);
const records = {};
const counts = {
  catalogRecords: catalog.records.length,
  directMatches: 0,
  descriptions: 0,
  bpms: 0,
  keys: 0,
  supportingArtists: 0,
  supportingArtistProfileLinks: 0,
  videoCorrections: 0,
};
let after = null;
const seen = new Set();
for (const page of checkpoint.pages) {
  const receipt = unzip(directory + "/" + page.file);
  if (
    hash(JSON.stringify(receipt)) !== page.sha256 ||
    receipt.query !== TRACK_METADATA_QUERY ||
    receipt.variables.after !== after
  )
    throw Error("Page proof changed: " + page.file);
  const validation = validateTrackMetadataPage(receipt.body, {
    after,
    first: 500,
    snapshot,
    seen,
  });
  if (
    receipt.source !== checkpoint.source ||
    receipt.httpStatus !== 200 ||
    receipt.variables.first !== 500 ||
    validation.rows.some((r) => r.status !== "matched")
  )
    throw Error("Page identity or source mismatch");
  const connection = receipt.body.data.allProcessedTracks;
  for (const row of connection.nodes) {
    seen.add(row.id);
    const r = byTrack.get(row.id);
    if (!r || r.spinampArtistId !== row.artistId) continue;
    counts.directMatches++;
    const entry = {
      recordId: r.id,
      trackId: row.id,
      artistId: row.artistId,
      source: receipt.source,
      sourceType: "spinamp-track-index",
      onchainVerified: false,
      checkedAt: receipt.checkedAt,
      sourcePage: directory + "/" + page.file,
      sourcePageSha256: page.sha256,
      sourceRowSha256: hash(JSON.stringify(row)),
      description: row.description,
      processedMediaURIs: [
        row.lossyAudioUrl,
        row.lossyAudioIpfsHash ? "ipfs://" + row.lossyAudioIpfsHash : null,
      ].filter((v) => indexedContentKey(v)),
      audioMimeType: row.lossyAudioMimeType,
      supportingArtist: row.supportingArtist
        ? {
            id: row.supportingArtist,
            name: row.artistBySupportingArtist.name,
            sourceField: "supportingArtist",
            roleNotEstablished: true,
          }
        : null,
    };
    const enriched = applyTrackEnrichment(
      r,
      catalog.evidence[r.id],
      entry,
      catalog.people,
    );
    if (
      !enriched.indexedTrackMetadata &&
      !enriched.indexedMusicalFacts &&
      !enriched.indexedMediaType
    )
      continue;
    // Do not duplicate an unchanged original description merely to carry MIME.
    if (
      !enriched.indexedTrackMetadata?.description &&
      !enriched.indexedMusicalFacts
    )
      entry.description = null;
    records[r.id] = entry;
    if (enriched.indexedTrackMetadata?.description) counts.descriptions++;
    if (enriched.indexedMusicalFacts?.bpm) counts.bpms++;
    if (enriched.indexedMusicalFacts?.key) counts.keys++;
    if (enriched.indexedTrackMetadata?.supportingArtist)
      counts.supportingArtists++;
    if (enriched.indexedTrackMetadata?.supportingArtist?.personId)
      counts.supportingArtistProfileLinks++;
    if (enriched.indexedMediaType) counts.videoCorrections++;
  }
  after = connection.pageInfo.endCursor;
}
if (seen.size !== snapshot.size)
  throw Error("Source identity census incomplete");
const output = {
  schemaVersion: 1,
  checkedAt: checkpoint.updatedAt || checkpoint.lastCampaign?.finishedAt,
  source: "https://api.spinamp.xyz/v3/graphql",
  sourceSnapshotSha256: checkpoint.snapshotSha256,
  scope:
    "Exact processed-track/artist bindings. Indexed descriptions remain separate; explicit musical values only fill absent supplied facts. MIME applies only to the selected matching asset. No new NFT identities or playback verification.",
  counts: {
    ...counts,
    distinctSupportingArtists: new Set(
      Object.values(records)
        .map((r) => r.supportingArtist?.id)
        .filter(Boolean),
    ).size,
    enrichedRecords: Object.keys(records).length,
  },
  records,
};
writeFileSync("data/spinamp/track-enrichment.json", JSON.stringify(output));
writeFileSync(
  directory + "/enrichment-summary.json",
  JSON.stringify({ ...output, records: undefined }, null, 2) + "\n",
);
console.log(JSON.stringify(output.counts));
