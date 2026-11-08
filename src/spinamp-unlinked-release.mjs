// Listening-only public index records: no inferred NFT, wallet, or chain identity.
import { createHash } from "node:crypto";
import { storageURL } from "./nft-reader.mjs";
import { contentKey, validURI } from "../scripts/spinamp-import.mjs";
export const INDEX_SOURCE = "https://api.spinamp.xyz/v3/graphql";
const digest = (value) => createHash("sha256").update(value).digest("hex");
const stored = (value) => {
  try {
    return validURI(value) ? storageURL(value) : null;
  } catch {
    return null;
  }
};
const clean = (value) => (typeof value === "string" ? value.trim() : null);
export function indexedAudioReferences(track) {
  return [
    ...new Set(
      [
        clean(track.lossyAudioUrl),
        typeof track.lossyAudioIpfsHash === "string" &&
        /^[a-zA-Z0-9]+$/.test(track.lossyAudioIpfsHash.trim())
          ? "ipfs://" + track.lossyAudioIpfsHash.trim()
          : null,
      ].filter((v) => v && stored(v)),
    ),
  ];
}
export function unlinkedCandidate(track, options = {}) {
  const name = clean(track.artistByArtistId?.name),
    title = clean(track.title);
  if (!name || !title || !track.artistId || !track.id)
    return { reason: "missing-exact-track-artist-identity" };
  if (track.platformId === "pods")
    return { reason: "podcast-platform-outside-music-scope" };
  const audio = indexedAudioReferences(track);
  const artworks = [
    clean(track.lossyArtworkUrl),
    track.lossyArtworkIpfsHash ? "ipfs://" + track.lossyArtworkIpfsHash : null,
  ].filter(Boolean);
  const artKeys = new Set(artworks.map(contentKey));
  if (
    audio.some(
      (uri) =>
        artKeys.has(contentKey(uri)) ||
        /\.(png|jpe?g|webp|gif|svg)([?#]|$)/i.test(uri),
    )
  )
    return { reason: "audio-reference-is-artwork" };
  if (!audio.length) return { reason: "unsupported-or-missing-indexed-audio" };
  const id = "spinamp-" + digest(track.id).slice(0, 20);
  const knownPete =
    track.artistId.toLowerCase() ===
    "ethereum/0x625307de45bd25ad6bf6cc7391a308fc84067cf7";
  const artistId = knownPete
    ? "pete-rango"
    : options.artistIds?.get(track.artistId) ||
      "spinamp-artist-" + digest(track.artistId).slice(0, 20);
  const network = track.id.split("/")[0];
  const indexedNetwork = [
    "ethereum",
    "base",
    "optimism",
    "polygon",
    "zora",
    "solana",
  ].includes(network)
    ? network
    : null;
  const duration = Number(track.duration);
  const mediaURI = audio[0],
    imageURI = artworks.find((uri) => stored(uri)) || null;
  const sourceTrackSha256 = digest(JSON.stringify(track));
  const record = {
    id,
    title,
    artist: name,
    artistId,
    assetType: "indexed-release",
    mintStatus: "unconfirmed",
    platform: options.platformNames?.[track.platformId] || track.platformId,
    kind: "audio",
    mediaTypeProvisional: true,
    durationSeconds:
      Number.isFinite(duration) && duration > 0 ? duration : null,
    imageURI,
    originalRelease: validURI(track.websiteUrl) ? track.websiteUrl : null,
    discovery: "Spinamp public track index",
    spinampTrackId: track.id,
    spinampArtistId: track.artistId,
    ...(indexedNetwork ? { indexedNetwork } : {}),
    indexedSourceDate: {
      date: track.createdAtTime || null,
      source: INDEX_SOURCE,
      onchainVerified: false,
      kind: "index-record-created",
    },
    musicMetadata: {
      status: "not-read",
      sourceType: "spinamp-track-index",
      source: INDEX_SOURCE,
      onchainVerified: false,
      details: {},
      bpms: [],
      keys: [],
      credits: [],
      collaborators: [],
    },
  };
  const evidence = {
    status: "indexed",
    source: INDEX_SOURCE,
    sourceType: "spinamp-track-index",
    mediaSourceType: "spinamp-preserved-audio",
    checkedAt: options.sourceCheckedAt || null,
    sourceTrackSha256,
    mintStatus: "unconfirmed",
    onchainVerified: false,
    playbackVerified: false,
    metadataURI: null,
    metadataURL: null,
    originalMediaURI: null,
    originalMediaMissing: true,
    mediaURI,
    mediaURL: stored(mediaURI),
    preservedMediaAlternatives: audio
      .slice(1)
      .map((uri) => ({ uri, url: stored(uri) })),
    imageURI,
    imageURL: stored(imageURI),
    mediaKindProvisional: true,
    mediaEvidence: {
      basis:
        "Explicit lossyAudioUrl/lossyAudioIpfsHash fields in the preserved public processed-track record",
      durationKnown: record.durationSeconds !== null,
      indexedMimeType: null,
    },
    metadataLocation:
      "Public Spinamp release and preserved audio reference. NFT mint link unconfirmed; no contract, token, collector or onchain verification is asserted.",
  };
  const avatar = clean(
    options.avatarProfiles?.get(track.artistId) ||
      track.artistByArtistId?.avatarIpfsHash,
  );
  const portrait = avatar ? stored("ipfs://" + avatar) : null;
  const person = {
    id: artistId,
    name,
    kind: "Artist",
    spinampArtistId: track.artistId,
    bio: "Artist identity supplied by the public Spinamp track index; not a verified complete discography.",
    links: [{ label: "Spinamp source", url: "https://app.spinamp.xyz/" }],
    sources: [],
    ...(portrait
      ? {
          portrait: {
            src: portrait,
            alt: name,
            source: INDEX_SOURCE,
            originalURI: "ipfs://" + avatar,
            checkedAt: options.sourceCheckedAt || null,
            note: "Public profile image attributed by the Spinamp artist index",
          },
        }
      : {}),
  };
  return { record, evidence, person };
}
export function applyUnlinkedObservation(candidate, observation) {
  const { record, evidence } = candidate;
  if (
    !record ||
    observation?.id !== record.id ||
    observation.spinampTrackId !== record.spinampTrackId ||
    observation.mediaURI !== evidence.mediaURI
  )
    return null;
  const known = new Set(
    [
      evidence.mediaURI,
      ...evidence.preservedMediaAlternatives.map((a) => a.uri),
    ].map(contentKey),
  );
  const allowed = (uri) => known.has(contentKey(uri));
  if (
    observation.status === "unavailable" &&
    observation.attempts?.length >= 2 &&
    observation.attempts.every(
      (a) =>
        allowed(a.url) &&
        a.state?.readyState >= 3 &&
        a.state.videoWidth > 0 &&
        a.state.audioDecodedBytes === 0,
    )
  )
    return "video-without-confirmed-audio-needs-review";
  const p = observation.playback;
  if (
    observation.status !== "played" ||
    !allowed(observation.workingURL) ||
    !(p?.currentTime > 0.5) ||
    !(p.audioDecodedBytes > 0)
  )
    return null;
  record.kind = p.videoWidth > 0 && p.videoHeight > 0 ? "video" : "audio";
  record.mediaTypeProvisional = false;
  record.playback = {
    workingURL: observation.workingURL,
    sourceType: "spinamp-preserved-audio",
    checkedAt: observation.checkedAt,
  };
  Object.assign(evidence, {
    mediaKindProvisional: false,
    playbackVerified: true,
    playbackCheckedAt: observation.checkedAt,
    playbackScope: "native-decoded-startup",
    playbackEvidenceFile: observation.evidenceFile,
  });
  return null;
}
export function buildUnlinkedBundle(
  input,
  existing,
  platformNames = {},
  observations = [],
) {
  const observed = new Map(observations.map((r) => [r.id, r]));
  const existingIds = new Set(existing.records.map((r) => r.id));
  const byTrack = new Map(
    existing.records
      .filter((r) => r.spinampTrackId)
      .map((r) => [r.spinampTrackId, r.id]),
  );
  const artistIds = new Map(
    existing.records
      .filter((r) => r.spinampArtistId)
      .map((r) => [r.spinampArtistId, r.artistId]),
  );
  const byArtistMedia = new Map();
  for (const item of input.existingProcessedMedia || [])
    if (existingIds.has(item.recordId))
      for (const uri of item.audioReferences)
        byArtistMedia.set(item.artistId + "|" + contentKey(uri), item.recordId);
  const avatarProfiles = new Map(
    (input.artistProfiles || []).map((p) => [p.id, p.avatarIpfsHash]),
  );
  const records = [],
    evidence = {},
    people = new Map(),
    excluded = [],
    duplicates = [];
  for (const track of input.tracks) {
    const c = unlinkedCandidate(track, {
      platformNames,
      artistIds,
      sourceCheckedAt: input.inventoryFinishedAt,
      avatarProfiles,
    });
    if (c.reason) {
      excluded.push({ trackId: track.id, reason: c.reason });
      continue;
    }
    const mediaReason = applyUnlinkedObservation(c, observed.get(c.record.id));
    if (mediaReason) {
      excluded.push({
        trackId: track.id,
        recordId: c.record.id,
        reason: mediaReason,
        evidenceFile: observed.get(c.record.id).evidenceFile,
      });
      continue;
    }
    const mediaKeys = indexedAudioReferences(track).map(
      (uri) => track.artistId + "|" + contentKey(uri),
    );
    const existingId =
      byTrack.get(track.id) ||
      (existingIds.has(c.record.id) ? c.record.id : null) ||
      mediaKeys.map((k) => byArtistMedia.get(k)).find(Boolean);
    if (existingId) {
      for (const key of mediaKeys) byArtistMedia.set(key, existingId);
      duplicates.push({
        trackId: track.id,
        existingId,
        reason: byTrack.has(track.id)
          ? "exact-processed-track"
          : "exact-artist-and-preserved-media",
      });
      continue;
    }
    records.push(c.record);
    evidence[c.record.id] = c.evidence;
    people.set(c.person.id, c.person);
    byTrack.set(track.id, c.record.id);
    existingIds.add(c.record.id);
    for (const key of mediaKeys) byArtistMedia.set(key, c.record.id);
  }
  return {
    bundle: {
      source: INDEX_SOURCE,
      checkedAt: input.inventoryFinishedAt,
      scope:
        "Public indexed releases with preserved audio and unconfirmed mint links. Not NFT, ownership, blockchain or playback verification.",
      records,
      evidence,
      proposedPeople: [...people.values()],
    },
    audit: {
      sourceRecords: input.tracks.length,
      admitted: records.length,
      excluded,
      duplicates,
      unknownDuration: records.filter((r) => r.durationSeconds === null).length,
      platformCounts: records.reduce(
        (a, r) => ((a[r.platform] = (a[r.platform] || 0) + 1), a),
        {},
      ),
      stableIdsUseSameTrackHashAsNftImporter: true,
    },
  };
}

// Rebuild the complete supplemental dataset against the NFT-linked baseline,
// excluding its own previously admitted rows so regeneration is idempotent.
export function unlinkedImportBaseline(existing) {
  const records = existing.records.filter(
    (r) => r.assetType !== "indexed-release",
  );
  const ids = new Set(records.map((r) => r.id));
  return {
    ...existing,
    records,
    evidence: Object.fromEntries(
      Object.entries(existing.evidence || {}).filter(([id]) => ids.has(id)),
    ),
  };
}
