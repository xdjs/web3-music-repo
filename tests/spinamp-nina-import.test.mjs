import test from "node:test";
import assert from "node:assert/strict";
import {
  makeCandidate,
  buildBundle,
  applyNinaPlaybackObservation,
} from "../scripts/spinamp-import.mjs";
const mint = "122gW5E6uqWKEsb1KdCjVhWtarbCTdN7hR1bjt9dgdaw",
  release = "CZ2wpojt6YHhPPaGJNUuyXPAFDwGjEK1tbJHipcMT1Wn";
const t = {
  id: "solana/" + mint,
  platformId: "nina",
  platformInternalId: mint,
  title: "A recording",
  artistId: "artist-source-id",
  artistByArtistId: { name: "Artist" },
  duration: "0.00",
  websiteUrl: "https://nina.market/" + release,
  lossyAudioUrl: "https://www.arweave.net/audio?ext=mp3",
};
const n = {
  id: mint,
  chainId: "solana",
  contractAddress: mint,
  tokenId: null,
  nftFactoryByNftFactoryId: { standard: "metaplex" },
  mediaURI: t.lossyAudioUrl,
  imageURI: "ar://cover",
  tokenUri: "ar://metadata",
  mimeType: null,
  createdAtTime: "2022-02-07T11:38:14.795+00:00",
  createdAtBlockNumber: null,
};
test("Nina exact mint and indexed audio linkage can admit unknown duration without claiming playback", () => {
  const c = makeCandidate(t, n, { nina: "Nina" }, "now");
  assert.ok(c.record);
  assert.equal(c.record.mint, mint);
  assert.equal(c.record.chainId, "solana");
  assert.equal(c.record.standard, "METAPLEX");
  assert.equal(Object.hasOwn(c.record, "contract"), false);
  assert.equal(Object.hasOwn(c.record, "tokenId"), false);
  assert.equal(c.record.ninaReleaseAddress, release);
  assert.equal(c.record.durationSeconds, null);
  assert.equal(c.record.indexedNftCreation, undefined);
  assert.equal(c.record.indexedSourceDate.kind, "indexed-metadata-date");
  assert.equal(c.evidence.playbackVerified, false);
  assert.equal(c.evidence.onchainVerified, false);
  assert.equal(c.evidence.mediaKindProvisional, true);
  assert.equal(c.evidence.mediaEvidence.durationKnown, false);
  assert.equal(c.evidence.mediaEvidence.indexedMimeType, null);
});
test("Nina admission never infers mint identity or generic audio from a title or filename", () => {
  assert.equal(makeCandidate(t, null, {}, "now").reason, "no-indexed-nft");
  for (const changed of [
    { platformId: "other-solana" },
    { id: "solana/" + release },
    { platformInternalId: release },
  ])
    assert.equal(
      makeCandidate({ ...t, ...changed }, n, {}, "now").reason,
      "unverified-solana-platform-mint-mapping",
    );
  assert.equal(
    makeCandidate({ ...t, lossyAudioUrl: "ar://different" }, n, {}, "now")
      .reason,
    "no-indexed-audio-evidence",
  );
  assert.equal(
    makeCandidate(t, { ...n, mediaURI: n.imageURI }, {}, "now").reason,
    "missing-or-artwork-only-original-media",
  );
});
test("distinct case-sensitive mints survive same-content dedup; same mint deduplicates", () => {
  const other = mint.replace("W", "w"),
    t2 = { ...t, id: "solana/" + other, platformInternalId: other },
    n2 = { ...n, id: other, contractAddress: other };
  const inv = { records: [t, t2] },
    refs = {
      references: { [t.id]: n, [t2.id]: n2 },
      failures: {},
      updatedAt: "now",
    };
  const result = buildBundle(
    inv,
    refs,
    { records: [], evidence: {} },
    { nina: "Nina" },
  );
  assert.equal(result.bundle.records.length, 2);
  const duplicate = buildBundle(
    inv,
    refs,
    { records: [{ id: "old", chainId: "solana", mint }], evidence: {} },
    { nina: "Nina" },
  );
  assert.equal(duplicate.bundle.records.length, 1);
  assert.equal(duplicate.audit.duplicates[0].existingId, "old");
});
test("Nina bounded original timeout may choose only its own observed separately preserved audio", () => {
  const track = { ...t, lossyAudioIpfsHash: "QmPreserved" },
    c = makeCandidate(track, n, { nina: "Nina" }, "now");
  const observation = {
    id: c.record.id,
    chainId: "solana",
    mint,
    status: "unavailable",
    mediaURI: n.mediaURI,
    evidenceFile: "data/spinamp/nina-playback-verification.json",
    preservedFallback: {
      status: "played",
      mediaURI: "ipfs://QmPreserved",
      playback: {
        currentTime: 0.5,
        audioDecodedBytes: 100,
        videoWidth: 0,
        videoHeight: 0,
      },
    },
  };
  assert.equal(
    applyNinaPlaybackObservation(
      c.record,
      c.evidence,
      {
        ...observation,
        preservedFallback: {
          ...observation.preservedFallback,
          mediaURI: "ipfs://Unrelated",
        },
      },
      track,
    ),
    false,
  );
  assert.equal(
    applyNinaPlaybackObservation(c.record, c.evidence, observation, track),
    true,
  );
  assert.equal(c.evidence.mediaURI, "ipfs://QmPreserved");
  assert.equal(c.evidence.originalMediaURI, n.mediaURI);
  assert.equal(c.evidence.originalMediaMissing, false);
  assert.equal(c.evidence.mediaSourceType, "spinamp-preserved-audio");
  assert.equal(
    c.evidence.originalMediaUnavailableReason,
    "original-startup-timeout",
  );
  assert.equal(c.evidence.onchainVerified, false);
  assert.equal(c.evidence.playbackVerified, false);
});
