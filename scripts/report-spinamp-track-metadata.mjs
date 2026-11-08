import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { createCatalogLoader } from "../src/catalog-bundle.mjs";
import { extractMusicMetadata } from "../src/extract-music-metadata.mjs";
import { musicFacts } from "../src/music-facts.mjs";
import { contentKey } from "./spinamp-import.mjs";
import {
  buildUnlinkedBundle,
  unlinkedImportBaseline,
} from "../src/spinamp-unlinked-release.mjs";
const read = (p) => JSON.parse(readFileSync(p)),
  unzip = (p) => JSON.parse(gunzipSync(readFileSync(p))),
  hash = (v) => createHash("sha256").update(v).digest("hex");
const directory = "data/spinamp/processed-track-metadata",
  checkpoint = read(directory + "/checkpoint.json");
if (!checkpoint.complete || checkpoint.frozenMatched !== 52987)
  throw Error("Need complete frozen-source checkpoint before candidate audit");
const baseline = unlinkedImportBaseline(createCatalogLoader()());
const input = unzip("data/spinamp/unlinked-release-inputs.json.gz"),
  platforms = read("data/spinamp/schema-and-counts.json").body.data.allPlatforms
    .nodes,
  names = Object.fromEntries(platforms.map((p) => [p.id, p.name]));
names.sound = "Sound";
names.zora = "Zora";
const mediaFile = "data/spinamp/unlinked-release-media-verification.json",
  media = read(mediaFile);
const additions = buildUnlinkedBundle(
  input,
  baseline,
  names,
  media.results.map((r) => ({
    ...r,
    checkedAt: media.checkedAt,
    evidenceFile: mediaFile,
  })),
).bundle;
const records = [...baseline.records, ...additions.records],
  recordMap = new Map(
    records.filter((r) => r.spinampTrackId).map((r) => [r.spinampTrackId, r]),
  ),
  evidence = { ...baseline.evidence, ...additions.evidence };
const candidates = [];
const statistics = {
  directTrackMatches: 0,
  additionalDescriptionVersions: 0,
  additionalExplicitBpm: 0,
  additionalExplicitKeys: 0,
  matchingProcessedMedia: 0,
  indexedVideoCorrections: 0,
  supportingArtistMatches: 0,
};
const raw = {
  explicitBpmTracks: 0,
  explicitKeyTracks: 0,
  supportingArtistTracks: 0,
};
for (const page of checkpoint.pages) {
  const receipt = unzip(directory + "/" + page.file);
  for (const row of receipt.body.data.allProcessedTracks.nodes) {
    const metadata = extractMusicMetadata({
      description: row.description || "",
    });
    if (metadata.bpms.length) raw.explicitBpmTracks++;
    if (metadata.keys.length) raw.explicitKeyTracks++;
    if (row.supportingArtist) raw.supportingArtistTracks++;
    const r = recordMap.get(row.id);
    if (!r) continue;
    statistics.directTrackMatches++;
    const supplied = musicFacts({ ...r, audioAnalysis: null });
    const descriptionAdditional =
      !!row.description?.trim() &&
      !r.musicMetadata?.details?.Description?.includes(row.description.trim());
    const bpms =
        metadata.bpms.length === 1 && metadata.bpms[0] !== supplied.bpm
          ? metadata.bpms
          : [],
      keys =
        metadata.keys.length === 1 && metadata.keys[0] !== supplied.key
          ? metadata.keys
          : [];
    const processedKeys = [
      row.lossyAudioUrl,
      row.lossyAudioIpfsHash ? "ipfs://" + row.lossyAudioIpfsHash : null,
    ]
      .filter(Boolean)
      .map(contentKey);
    const selectedURI = evidence[r.id]?.mediaURI;
    const sameProcessedMedia = processedKeys.includes(contentKey(selectedURI));
    const videoCorrection =
      sameProcessedMedia &&
      row.lossyAudioMimeType?.startsWith("video/") &&
      r.kind !== "video";
    if (descriptionAdditional) statistics.additionalDescriptionVersions++;
    if (bpms.length) statistics.additionalExplicitBpm++;
    if (keys.length) statistics.additionalExplicitKeys++;
    if (sameProcessedMedia) statistics.matchingProcessedMedia++;
    if (videoCorrection) statistics.indexedVideoCorrections++;
    if (row.supportingArtist) statistics.supportingArtistMatches++;
    if (
      descriptionAdditional ||
      bpms.length ||
      keys.length ||
      videoCorrection ||
      row.supportingArtist
    )
      candidates.push({
        recordId: r.id,
        trackId: row.id,
        title: r.title,
        assetType: r.assetType || "token-linked",
        source: "https://api.spinamp.xyz/v3/graphql",
        sourceType: "spinamp-track-index",
        onchainVerified: false,
        sourcePage: directory + "/" + page.file,
        sourcePageSha256: page.sha256,
        sourceRowSha256: hash(JSON.stringify(row)),
        checkedAt: receipt.checkedAt,
        descriptionAdditional,
        additionalExplicitBpm: bpms,
        additionalExplicitKeys: keys,
        videoCorrection: videoCorrection
          ? {
              indexedMimeType: row.lossyAudioMimeType,
              selectedURI,
              currentKind: r.kind,
            }
          : null,
        supportingArtist: row.supportingArtist
          ? {
              sourceField: "supportingArtist",
              id: row.supportingArtist,
              profile: row.artistBySupportingArtist,
              roleNotEstablished: true,
            }
          : null,
      });
  }
}
const result = {
  checkedAt: new Date().toISOString(),
  scope:
    "Offline review candidates only; nothing applied to catalog. Description variants remain source attributed; only existing strict explicit-label extraction supplies BPM/key. Processed MIME may classify only the exact selected matching URI and remains index asserted, not decoded-media verification. SupportingArtist is a source relation, not proof of a producer/writer role.",
  baselineRecords: baseline.records.length,
  listeningCandidates: additions.records.length,
  combinedRecords: records.length,
  baselineMetadataSha256: hash(readFileSync("data/music-metadata.json")),
  listeningInputSha256: hash(
    readFileSync("data/spinamp/unlinked-release-inputs.json.gz"),
  ),
  statistics,
  raw,
  candidates,
};
writeFileSync(
  directory + "/application-candidates.json.gz",
  gzipSync(JSON.stringify(result)),
);
writeFileSync(
  directory + "/application-summary.json",
  JSON.stringify(
    { ...result, candidates: undefined, candidateRecords: candidates.length },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({ statistics, raw, candidateRecords: candidates.length }),
);
