import { extractMusicMetadata } from "./extract-music-metadata.mjs";
import { musicFacts } from "./music-facts.mjs";

export const INDEXED_TRACK_SOURCE = "https://api.spinamp.xyz/v3/graphql";
// Identity comparison only: never lower-case CIDs or normalize token/artist IDs.
export function indexedContentKey(value) {
  if (typeof value !== "string" || value.length > 4096) return null;
  const text = value.trim();
  // Queries may request transformed content. Preserve them for every scheme;
  // neither an ext/id hint nor a format parameter is assumed inert.
  const withoutFragment = text.split("#")[0];
  const queryOffset = withoutFragment.indexOf("?");
  const suffix = queryOffset < 0 ? "" : withoutFragment.slice(queryOffset);
  const path =
    queryOffset < 0 ? withoutFragment : withoutFragment.slice(0, queryOffset);
  if (text.startsWith("ipfs://"))
    return (
      "ipfs:" +
      path
        .slice(7)
        .replace(/^ipfs\//, "")
        .replace(/\/$/, "") +
      suffix
    );
  if (text.startsWith("ar://")) return "ar:" + path.slice(5) + suffix;
  try {
    const u = new URL(text);
    if (u.protocol !== "https:" || u.username || u.password) return null;
    if (
      [
        "ipfs.io",
        "cloudflare-ipfs.com",
        "gateway.pinata.cloud",
        "dweb.link",
        "ipfs.filebase.io",
        "nftstorage.link",
        "w3s.link",
      ].includes(u.hostname) &&
      u.pathname.startsWith("/ipfs/")
    )
      return "ipfs:" + u.pathname.slice(6).replace(/\/$/, "") + u.search;
    if (u.hostname === "arweave.net" || u.hostname.endsWith(".arweave.net"))
      return "ar:" + u.pathname.slice(1) + u.search;
    return u.href;
  } catch {
    return null;
  }
}
// Source MIME may describe a video before an indexed audio representation was
// produced. Explicit audio URLs are a conflict, not proof of decoded video.
export function hasExplicitAudioFormat(value) {
  if (typeof value !== "string") return false;
  const audioExtension =
    /\.(?:mp3|mp2|mpa|wav|wave|flac|ogg|oga|opus|m4a|m4b|aac|aif|aiff|aifc|alac|weba|amr|wma)$/i;
  const audioHint =
    /^(?:\.?)(?:mp3|mp2|mpa|wav|wave|flac|ogg|oga|opus|m4a|m4b|aac|aif|aiff|aifc|alac|weba|amr|wma)$/i;
  try {
    const url = new URL(value.trim());
    let path = url.pathname;
    try {
      path = decodeURIComponent(path);
    } catch {}
    if (audioExtension.test(path)) return true;
    for (const [name, hint] of url.searchParams) {
      if (
        ["ext", "format"].includes(name.toLowerCase()) &&
        (audioHint.test(hint.trim()) ||
          /^audio\/[a-z0-9.+-]+$/i.test(hint.trim()))
      )
        return true;
    }
  } catch {}
  return false;
}
export function validTrackEnrichment(record, entry) {
  return !!(
    entry &&
    entry.recordId === record.id &&
    entry.trackId === record.spinampTrackId &&
    typeof entry.trackId === "string" &&
    entry.artistId === record.spinampArtistId &&
    typeof entry.artistId === "string" &&
    entry.source === INDEXED_TRACK_SOURCE &&
    entry.sourceType === "spinamp-track-index" &&
    entry.onchainVerified === false &&
    Number.isFinite(Date.parse(entry.checkedAt)) &&
    /^data\/spinamp\/processed-track-metadata\/\d{3}\.json\.gz$/.test(
      entry.sourcePage,
    ) &&
    /^[a-f0-9]{64}$/.test(entry.sourcePageSha256) &&
    /^[a-f0-9]{64}$/.test(entry.sourceRowSha256) &&
    (entry.description === null ||
      (typeof entry.description === "string" &&
        new TextEncoder().encode(entry.description).byteLength <= 1048576)) &&
    Array.isArray(entry.processedMediaURIs) &&
    entry.processedMediaURIs.length <= 2 &&
    entry.processedMediaURIs.every((v) => !!indexedContentKey(v)) &&
    (entry.audioMimeType === null ||
      /^(audio|video)\/[a-zA-Z0-9.+-]{1,64}$/.test(entry.audioMimeType)) &&
    (!entry.supportingArtist ||
      (typeof entry.supportingArtist.id === "string" &&
        typeof entry.supportingArtist.name === "string" &&
        entry.supportingArtist.name.length <= 1000 &&
        entry.supportingArtist.sourceField === "supportingArtist" &&
        entry.supportingArtist.roleNotEstablished === true))
  );
}
export function applyTrackEnrichment(record, evidence, entry, people = []) {
  if (!validTrackEnrichment(record, entry)) return record;
  const result = { ...record };
  const proof = Object.fromEntries(
    [
      "source",
      "sourceType",
      "onchainVerified",
      "checkedAt",
      "sourcePage",
      "sourcePageSha256",
      "sourceRowSha256",
    ].map((k) => [k, entry[k]]),
  );
  const description = entry.description;
  const originalDescriptions = record.musicMetadata?.details?.Description || [];
  const additionalDescription =
    description?.trim() &&
    !originalDescriptions.some((value) => value.trim() === description.trim());
  const facts = musicFacts({
    ...record,
    indexedMusicalFacts: null,
    audioAnalysis: null,
  });
  const extracted = extractMusicMetadata({ description: description || "" });
  // Conflicting original values are not missing values. Retain them unresolved.
  const bpm =
    !facts.bpm &&
    !record.musicMetadata?.bpms?.length &&
    extracted.bpms.length === 1
      ? extracted.bpms[0]
      : null;
  const key =
    !facts.key &&
    !record.musicMetadata?.keys?.length &&
    extracted.keys.length === 1
      ? extracted.keys[0]
      : null;
  if (bpm || key) result.indexedMusicalFacts = { ...proof, bpm, key };
  const support = entry.supportingArtist;
  let supportingArtist = null;
  if (support) {
    const matches = people.filter((p) => p.spinampArtistId === support.id);
    supportingArtist = {
      ...support,
      personId: matches.length === 1 ? matches[0].id : null,
    };
    if (supportingArtist.personId)
      result.personIds = [
        ...new Set([...(record.personIds || []), supportingArtist.personId]),
      ];
  }
  if (additionalDescription || supportingArtist)
    result.indexedTrackMetadata = {
      ...proof,
      trackId: entry.trackId,
      description: additionalDescription ? description : null,
      supportingArtist,
    };
  // Respect the actual selected playback asset, including artist corrections.
  // A different working URL is not evidence about the original indexed asset.
  const selectedURI =
    record.playback?.workingURL || evidence?.mediaURL || evidence?.mediaURI;
  const selectedKey = indexedContentKey(selectedURI);
  const sameAsset =
    selectedKey &&
    entry.processedMediaURIs.some(
      (uri) => indexedContentKey(uri) === selectedKey,
    );
  if (
    record.kind === "audio" &&
    sameAsset &&
    !hasExplicitAudioFormat(selectedURI) &&
    entry.audioMimeType?.startsWith("video/") &&
    !record.playbackOverride &&
    !record.playbackCopy &&
    !record.playback?.sourceType
  ) {
    result.kind = "video";
    result.mediaTypeProvisional = false;
    result.indexedMediaType = {
      ...proof,
      mimeType: entry.audioMimeType,
      mediaURI: selectedURI,
      verification: "index-asserted; not decoded-media verification",
    };
  }
  return result;
}
