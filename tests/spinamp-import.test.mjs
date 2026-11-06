import test from "node:test";
import assert from "node:assert/strict";
import {
  nftIdentity,
  applyMediaObservation,
  contentKey,
  makeCandidate,
  buildBundle,
} from "../scripts/spinamp-import.mjs";
const t = {
  id: "base/0x" + "a".repeat(40) + "/hash",
  title: "Song",
  platformId: "sound",
  artistId: "artist-source-id",
  artistByArtistId: { name: "Artist" },
  duration: 120,
  websiteUrl: "https://www.sound.xyz/artist/song",
};
const n = {
  chainId: "base",
  contractAddress: "0x" + "a".repeat(40),
  tokenId: "0",
  nftFactoryByNftFactoryId: { standard: "erc721" },
  mediaURI: "ipfs://QmSound",
  imageURI: "ipfs://QmCover",
  metadataArtist: "Artist",
  tokenUri: "ar://metadata",
  mimeType: "audio/wav",
};
test("exact NFT identity required; token zero preserved only when explicit", () => {
  assert.equal(nftIdentity(n).tokenId, "0");
  for (const changed of [
    { tokenId: null },
    { tokenId: "0x123" },
    { chainId: "solana" },
    { chainId: "sepolia" },
    { contractAddress: "abc" },
    { nftFactoryByNftFactoryId: { standard: "erc20" } },
  ])
    assert.equal(nftIdentity({ ...n, ...changed }), null);
});
test("content dedup preserves CID case and path, equates gateways", () => {
  assert.equal(
    contentKey("https://ipfs.io/ipfs/QmAb/track.mp3?download=1"),
    contentKey("ipfs://QmAb/track.mp3"),
  );
  assert.notEqual(contentKey("ipfs://QmAb"), contentKey("ipfs://Qmab"));
  assert.notEqual(contentKey("ipfs://QmAb/one"), contentKey("ipfs://QmAb/two"));
});
test("conflicting artist evidence is reviewable, not silently rewritten", () => {
  assert.equal(
    makeCandidate(
      t,
      { ...n, metadataArtist: "Another Artist" },
      { sound: "Sound" },
      "now",
    ).reason,
    "artist-attribution-conflict",
  );
});
test("artwork and missing original media cannot become playable imports", () => {
  for (const mediaURI of [null, "ipfs://QmCover", "https://x.example/a.jpg"])
    assert.ok(
      makeCandidate(t, { ...n, mediaURI }, { sound: "Sound" }, "now").reason,
    );
});
test("index assertions stay indexed and do not claim chain or playback checks", () => {
  const c = makeCandidate(t, n, { sound: "Sound" }, "now");
  assert.equal(c.evidence.status, "indexed");
  assert.equal(c.evidence.onchainVerified, false);
  assert.equal(c.evidence.playbackVerified, false);
  assert.equal(c.record.standard, "ERC721");
  assert.equal(c.record.platform, "Sound");
  assert.equal(c.evidence.mediaURI, n.mediaURI);
});
test("same NFT and same-contract same-media editions dedup; other chain remains distinct", () => {
  const old = { id: "old", ...nftIdentity(n) };
  const inv = { records: [t] };
  const refs = { references: { [t.id]: n }, updatedAt: "now" };
  assert.equal(
    buildBundle(inv, refs, { records: [old], evidence: {} }, { sound: "Sound" })
      .bundle.records.length,
    0,
  );
  const edition = { ...old, tokenId: "12" };
  assert.equal(
    buildBundle(
      inv,
      refs,
      {
        records: [edition],
        evidence: { old: { mediaURI: "https://ipfs.io/ipfs/QmSound" } },
      },
      { sound: "Sound" },
    ).bundle.records.length,
    0,
  );
  assert.equal(
    buildBundle(
      inv,
      refs,
      { records: [{ ...old, chainId: 1 }], evidence: {} },
      { sound: "Sound" },
    ).bundle.records.length,
    1,
  );
});
test("preserved index audio fallback is explicit and does not override original media", () => {
  const indexed = {
    ...t,
    lossyAudioUrl: "https://arweave.net/preserved-audio",
  };
  const c = makeCandidate(
    indexed,
    { ...n, mediaURI: null },
    { sound: "Sound" },
    "now",
  );
  assert.equal(c.evidence.sourceType, "spinamp-processed-media");
  assert.equal(c.evidence.originalMediaMissing, true);
  assert.equal(c.evidence.originalMediaURI, null);
  assert.equal(c.evidence.mediaURI, indexed.lossyAudioUrl);
  assert.equal(
    makeCandidate(indexed, n, { sound: "Sound" }, "now").evidence.mediaURI,
    n.mediaURI,
  );
});
test("unsafe numeric token IDs never round into a fabricated NFT identity", () => {
  assert.equal(nftIdentity({ ...n, tokenId: 9007199254740992 }), null);
  assert.equal(
    nftIdentity({ ...n, tokenId: "9007199254740993" }).tokenId,
    "9007199254740993",
  );
  assert.equal(nftIdentity({ ...n, chainId: "constructor" }), null);
});
test("unsupported original storage uses labeled preserved audio without broadening storage allowlist", () => {
  const c = makeCandidate(
    { ...t, lossyAudioUrl: "https://arweave.net/retained" },
    {
      ...n,
      mediaURI: "https://unknown.example/audio.mp4",
      mimeType: "video/mp4",
    },
    {},
    "now",
  );
  assert.equal(c.record.kind, "audio");
  assert.equal(c.evidence.originalMediaMissing, false);
  assert.equal(
    c.evidence.originalMediaUnavailableReason,
    "unsupported-original-storage",
  );
  assert.equal(
    c.evidence.originalMediaURI,
    "https://unknown.example/audio.mp4",
  );
  assert.equal(c.evidence.mediaURL, "https://arweave.net/retained");
  assert.equal(c.evidence.mediaSourceType, "spinamp-preserved-audio");
  const bad = makeCandidate(
    { ...t, lossyAudioUrl: "https://localhost/secret" },
    { ...n, mediaURI: "https://unknown.example/song.mp3" },
    {},
    "now",
  );
  assert.equal(bad.reason, "unsupported-original-storage");
});
test("trim whitespace, retain artwork gate, and only map Pete through exact known wallet identity", () => {
  assert.equal(
    makeCandidate(t, { ...n, mediaURI: "  ipfs://QmSound  " }, {}, "now")
      .evidence.mediaURI,
    "ipfs://QmSound",
  );
  const pete = {
    ...t,
    artistId: "ethereum/0x625307dE45Bd25AD6bf6cC7391a308fc84067cf7",
    artistByArtistId: { name: "Pete Rango" },
  };
  assert.equal(
    makeCandidate(pete, { ...n, metadataArtist: "p3t3rango" }, {}, "now").record
      .artistId,
    "pete-rango",
  );
  assert.equal(
    makeCandidate(
      { ...pete, artistId: "some-other-identity" },
      { ...n, metadataArtist: "Pete Rango" },
      {},
      "now",
    ).record.artistId.startsWith("spinamp-artist-"),
    true,
  );
  assert.equal(
    makeCandidate(pete, { ...n, metadataArtist: "LIL LIL" }, {}, "now").reason,
    "artist-attribution-conflict",
  );
  assert.equal(
    makeCandidate(
      { ...t, lossyAudioUrl: "ar://audio" },
      { ...n, mimeType: "image/png" },
      {},
      "now",
    ).reason,
    "missing-or-artwork-only-original-media",
  );
});
test("indexed NFT creation preserves attributed date/block, never checkedAt or invalid dates", () => {
  const c = makeCandidate(
    t,
    {
      ...n,
      createdAtTime: "2022-05-04T04:13:28+00:00",
      createdAtBlockNumber: "14708792",
    },
    {},
    "2026-11-06",
  );
  assert.deepEqual(c.record.indexedNftCreation, {
    date: "2022-05-04T04:13:28.000Z",
    blockNumber: 14708792,
    source: "https://api.spinamp.xyz/v3/graphql",
    onchainVerified: false,
  });
  assert.equal(
    makeCandidate(t, { ...n, createdAtTime: "bad" }, {}, "2026-11-06").record
      .indexedNftCreation,
    undefined,
  );
});
test("relation failures remain unresolved audit entries; stale metadata failures prevent completion", () => {
  const out = buildBundle(
    { records: [t, { ...t, id: "missing" }] },
    {
      references: { [t.id]: n },
      failures: { [t.id]: "retry failed", missing: "timeout" },
      updatedAt: "now",
    },
    { records: [], evidence: {} },
    {},
  );
  assert.equal(out.audit.unresolvedCount, 1);
  assert.equal(out.audit.metadataRetryFailures, 1);
  assert.equal(out.audit.relationScanComplete, false);
  assert.equal(out.audit.relationCensusComplete, false);
});
test("Pods is explicitly outside music scope without title heuristics on other platforms", () => {
  assert.equal(
    makeCandidate({ ...t, platformId: "pods" }, n, {}, "now").reason,
    "podcast-platform-outside-music-scope",
  );
  assert.ok(
    makeCandidate(
      { ...t, platformId: "zora", title: "A spoken word song" },
      n,
      {},
      "now",
    ).record,
  );
});
test("base64url Arweave IDs beginning with punctuation remain original media", () => {
  const uri = "ar://-eFn_-ha1Rt14BFaupETq85vnWtjDrlNDbflPTYrusA";
  const c = makeCandidate(t, { ...n, mediaURI: uri }, {}, "now");
  assert.equal(c.evidence.sourceType, "spinamp-index");
  assert.equal(c.evidence.mediaURI, uri);
});
test("observed selected-media type overrides opaque preserved-audio default only for exact content", () => {
  const track = { ...t, lossyAudioUrl: "ar://preserved" };
  const ref = {
    ...n,
    mediaURI: "https://unknown.example/video.mp4",
    mimeType: "video/mp4",
  };
  const inv = { records: [track] },
    refs = { references: { [track.id]: ref } },
    existing = { records: [], evidence: {} };
  const base = buildBundle(inv, refs, existing, {}).bundle;
  const row = {
    id: base.records[0].id,
    status: "played",
    mediaURI: "ar://preserved",
    playback: {
      currentTime: 0.5,
      audioDecodedBytes: 100,
      videoWidth: 320,
      videoHeight: 180,
    },
  };
  assert.equal(base.records[0].kind, "audio");
  const actual = buildBundle(inv, refs, existing, {}, [row]).bundle;
  assert.equal(actual.records[0].kind, "video");
  assert.equal(actual.evidence[row.id].onchainVerified, false);
  assert.equal(
    buildBundle(inv, refs, existing, {}, [
      { ...row, mediaURI: "ar://different" },
    ]).bundle.records[0].kind,
    "audio",
  );
});
test("native video override requires exact identity, content and decoded advancing media", () => {
  const r = {
      id: "verified",
      chainId: 8453,
      contract: "0x" + "a".repeat(40),
      tokenId: "1",
      kind: "audio",
    },
    e = { mediaURI: "ipfs://QmVideo", onchainVerified: false };
  const observation = {
    id: r.id,
    chainId: r.chainId,
    contract: r.contract,
    tokenId: r.tokenId,
    status: "played",
    mediaURI: "https://ipfs.io/ipfs/QmVideo",
    evidenceFile: "data/spinamp/video-kind-verification.json",
    checkedAt: "2026-11-06T18:00:00Z",
    playback: {
      currentTime: 0.5,
      audioDecodedBytes: 0,
      videoDecodedBytes: 120,
      videoWidth: 1920,
      videoHeight: 1080,
    },
  };
  for (const changed of [
    { mediaURI: "ipfs://QmDifferent" },
    { id: "other" },
    { tokenId: "2" },
    { chainId: 1 },
    { status: "unavailable" },
    { playback: { ...observation.playback, currentTime: 0 } },
  ])
    assert.equal(
      applyMediaObservation({ ...r }, { ...e }, { ...observation, ...changed }),
      false,
    );
  assert.equal(applyMediaObservation(r, e, observation), true);
  assert.equal(r.kind, "video");
  assert.equal(e.mediaKindEvidence, observation.evidenceFile);
  assert.equal(e.onchainVerified, false);
});
