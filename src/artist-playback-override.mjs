import { assetIdentityKey } from "./solana-identity.mjs";

// Artist-approved listening copies are separate from immutable NFT evidence.
// A changed token or original media reference invalidates the override.
export function applyArtistPlaybackOverride(record, evidence, override) {
  if (
    !override ||
    override.recordId !== record.id ||
    override.status !== "artist-approved" ||
    override.sourceType !== "artist-supplied-correction" ||
    !override.approvedBy ||
    !/^\d{4}-\d{2}-\d{2}$/.test(override.approvedAt || "") ||
    !/^\/media\/[a-z0-9][a-z0-9-]*\.mp4$/.test(override.playbackURL || "") ||
    !/^[0-9a-f]{64}$/.test(override.sha256 || "") ||
    !Number.isSafeInteger(override.byteLength) ||
    override.byteLength <= 0 ||
    !assetIdentityKey(record) ||
    assetIdentityKey(record) !== assetIdentityKey(override.expectedIdentity) ||
    !override.originalMediaURI ||
    evidence?.mediaURI !== override.originalMediaURI
  )
    return record;
  return {
    ...record,
    playback: {
      status: "artist-approved",
      workingURL: override.playbackURL,
      sourceType: override.sourceType,
      approvedBy: override.approvedBy,
      approvedAt: override.approvedAt,
      originalMediaURI: override.originalMediaURI,
      sha256: override.sha256,
    },
    playbackOverride: { ...override },
  };
}
