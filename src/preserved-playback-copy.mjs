import { assetIdentityKey } from "./solana-identity.mjs";
const SOURCE = "https://api.spinamp.xyz/v3/graphql";
const HOSTS = new Set([
  "ipfs.filebase.io",
  "magic.decentralized-content.com",
  "ipfs.io",
]);

// A separately verified listening copy never rewrites the original NFT evidence.
export function applyPreservedPlaybackCopy(record, evidence, copy) {
  if (
    !copy ||
    record.kind !== "audio" ||
    record.playback?.sourceType === "artist-supplied-correction" ||
    copy.recordId !== record.id ||
    copy.sourceType !== "spinamp-preserved-audio" ||
    copy.source !== SOURCE ||
    !assetIdentityKey(record) ||
    assetIdentityKey(record) !== assetIdentityKey(copy.expectedIdentity) ||
    evidence?.mediaURI !== copy.originalMediaURI ||
    evidence?.metadataURI !== copy.originalMetadataURI ||
    typeof copy.originalMediaURI !== "string" ||
    typeof copy.originalMetadataURI !== "string" ||
    copy.indexedReference?.mediaURI !== copy.originalMediaURI ||
    copy.indexedReference?.tokenUri !== copy.originalMetadataURI ||
    assetIdentityKey(copy.indexedReference) !== assetIdentityKey(record) ||
    !copy.trackId ||
    !/^[A-Za-z0-9]{32,100}$/.test(copy.audioIpfsHash || "") ||
    copy.verification?.status !== "played" ||
    !/^audio\//.test(copy.verification.mediaType || "") ||
    !(copy.verification.decodedAudioBytes > 0) ||
    !(copy.verification.currentTime >= 0.5) ||
    !Number.isFinite(copy.verification.duration) ||
    copy.verification.duration <= 0 ||
    !Number.isFinite(Date.parse(copy.verification.checkedAt))
  )
    return record;
  try {
    const u = new URL(copy.verification.url);
    if (
      u.protocol !== "https:" ||
      !HOSTS.has(u.hostname) ||
      u.username ||
      u.password ||
      u.port ||
      u.search ||
      u.hash ||
      u.pathname !== `/ipfs/${copy.audioIpfsHash}`
    )
      return record;
  } catch {
    return record;
  }
  return {
    ...record,
    playback: {
      status: "played",
      workingURL: copy.verification.url,
      checkedAt: copy.verification.checkedAt,
      sourceType: copy.sourceType,
      source: SOURCE,
      originalMediaURI: copy.originalMediaURI,
    },
    playbackCopy: { ...copy },
  };
}
