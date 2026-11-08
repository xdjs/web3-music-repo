import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  buildUnlinkedBundle,
  unlinkedCandidate,
  unlinkedImportBaseline,
  applyUnlinkedObservation,
} from "../src/spinamp-unlinked-release.mjs";
const track = {
  id: "base/0x" + "a".repeat(40) + "/1",
  title: "Song",
  platformId: "sound",
  artistId: "exact-artist-a",
  artistByArtistId: { name: "Same Name" },
  lossyAudioUrl: "https://arweave.net/" + "a".repeat(43),
  lossyAudioIpfsHash: "QmAudio",
  lossyArtworkUrl: "ipfs://QmArt",
  duration: "0",
  websiteUrl: "https://www.sound.xyz/artist/song",
  createdAtTime: "2024-01-01T00:00:00Z",
};
test("NFT-shaped track IDs never become asset/ownership claims; unknown duration remains provisional", () => {
  const c = unlinkedCandidate(track, { sourceCheckedAt: "2026-01-01" });
  assert.equal(
    c.record.id,
    "spinamp-" +
      createHash("sha256").update(track.id).digest("hex").slice(0, 20),
  );
  for (const k of ["chainId", "contract", "tokenId", "mint", "standard"])
    assert.equal(Object.hasOwn(c.record, k), false);
  assert.equal(c.record.indexedNetwork, "base");
  assert.equal(c.record.assetType, "indexed-release");
  assert.equal(c.record.mintStatus, "unconfirmed");
  assert.equal(c.record.durationSeconds, null);
  assert.equal(c.record.mediaTypeProvisional, true);
  assert.equal(c.evidence.onchainVerified, false);
  assert.equal(c.evidence.playbackVerified, false);
  assert.equal(c.evidence.metadataURI, null);
  assert.equal(c.evidence.originalMediaURI, null);
  assert.equal(c.evidence.mediaSourceType, "spinamp-preserved-audio");
});
test("artwork references, missing identities and unsupported sources are excluded", () => {
  assert.equal(
    unlinkedCandidate({ ...track, lossyAudioIpfsHash: "QmArt" }).reason,
    "audio-reference-is-artwork",
  );
  assert.ok(unlinkedCandidate({ ...track, artistId: null }).reason);
  assert.ok(
    unlinkedCandidate({
      ...track,
      lossyAudioUrl: "https://localhost/private",
      lossyAudioIpfsHash: null,
    }).reason,
  );
  assert.ok(unlinkedCandidate({ ...track, platformId: "pods" }).reason);
});
test("dedup requires same exact artist and media; matching names never merge people", () => {
  const second = { ...track, id: "another-id", artistId: "exact-artist-b" };
  const third = { ...track, id: "third-id" };
  const input = { tracks: [track, second, third], existingProcessedMedia: [] };
  const existing = { records: [] };
  const { bundle, audit } = buildUnlinkedBundle(input, existing);
  assert.equal(bundle.records.length, 2);
  assert.equal(audit.duplicates.length, 1);
  assert.notEqual(bundle.records[0].artistId, bundle.records[1].artistId);
  assert.equal(existing.records.length, 0);
  const again = buildUnlinkedBundle(input, { records: bundle.records });
  assert.equal(again.bundle.records.length, 0);
});
test("exact existing media links dedup but unrelated releases survive without an NFT key", () => {
  const existing = {
    records: [
      {
        id: "kept",
        spinampArtistId: track.artistId,
        artistId: "existing-artist",
      },
    ],
  };
  const input = {
    tracks: [track, { ...track, id: "different", artistId: "other-artist" }],
    existingProcessedMedia: [
      {
        recordId: "kept",
        artistId: track.artistId,
        audioReferences: ["ipfs://QmAudio"],
      },
    ],
  };
  const result = buildUnlinkedBundle(input, existing);
  assert.equal(result.audit.duplicates[0].existingId, "kept");
  assert.equal(result.bundle.records.length, 1);
});
test("Pete association is exact-wallet only, never display-name matching", () => {
  assert.equal(
    unlinkedCandidate({
      ...track,
      artistId: "ethereum/0x625307de45bd25ad6bf6cc7391a308fc84067cf7",
      artistByArtistId: { name: "p3t3rango" },
    }).record.artistId,
    "pete-rango",
  );
  assert.notEqual(
    unlinkedCandidate({ ...track, artistByArtistId: { name: "Pete Rango" } })
      .record.artistId,
    "pete-rango",
  );
});
test("portable cohort reconciles to the public exclusion ledger without inventing IDs", () => {
  const input = JSON.parse(
    gunzipSync(readFileSync("data/spinamp/unlinked-release-inputs.json.gz")),
  );
  assert.equal(input.tracks.length, 13515);
  assert.equal(new Set(input.tracks.map((r) => r.id)).size, 13515);
  assert.equal(input.nullEvidence.recordedZeroCount, 245);
  assert.equal(input.nullEvidence.withoutRecordedCount, 13270);
  for (const t of input.tracks) {
    const c = unlinkedCandidate(t);
    if (c.record)
      assert.equal(
        c.evidence.sourceTrackSha256,
        createHash("sha256").update(JSON.stringify(t)).digest("hex"),
      );
  }
  const report = JSON.parse(
    readFileSync("data/spinamp/missing-link-probe.json"),
  );
  assert.equal(report.results.length, 6);
  for (const r of report.results) {
    assert.equal(r.status, "received");
    assert.deepEqual(r.body.data.t0.nodes, []);
    assert.equal(r.body.data.t0.pageInfo.hasNextPage, false);
  }
});

test("full dataset regeneration ignores previously admitted indexed-release rows", () => {
  const baseline = {
    records: [{ id: "linked-existing" }],
    evidence: { "linked-existing": { status: "indexed" } },
  };
  const input = { tracks: [track], existingProcessedMedia: [] };
  const first = buildUnlinkedBundle(input, baseline);
  const admitted = {
    records: [...baseline.records, ...first.bundle.records],
    evidence: { ...baseline.evidence, ...first.bundle.evidence },
  };
  const next = buildUnlinkedBundle(input, unlinkedImportBaseline(admitted));
  assert.deepEqual(next.bundle, first.bundle);
  assert.equal(admitted.records.length, 2);
});

test("decoded observations bind exact track and media; video without confirmed audio is held", () => {
  const candidate = unlinkedCandidate(track);
  const observation = {
    id: candidate.record.id,
    spinampTrackId: track.id,
    mediaURI: candidate.evidence.mediaURI,
    status: "played",
    workingURL: candidate.evidence.mediaURL,
    checkedAt: "2026-01-01",
    evidenceFile: "receipt.json",
    playback: {
      currentTime: 1,
      audioDecodedBytes: 100,
      videoWidth: 640,
      videoHeight: 360,
    },
  };
  applyUnlinkedObservation(candidate, {
    ...observation,
    spinampTrackId: "unrelated",
  });
  assert.equal(candidate.record.kind, "audio");
  applyUnlinkedObservation(candidate, observation);
  assert.equal(candidate.record.kind, "video");
  assert.equal(candidate.evidence.playbackVerified, true);
  assert.equal(candidate.record.playback.sourceType, "spinamp-preserved-audio");
  const pending = unlinkedCandidate(track);
  const bad = {
    ...observation,
    status: "unavailable",
    attempts: [0, 1].map(() => ({
      url: observation.workingURL,
      state: { readyState: 4, videoWidth: 640, audioDecodedBytes: 0 },
    })),
  };
  assert.equal(
    applyUnlinkedObservation(pending, bad),
    "video-without-confirmed-audio-needs-review",
  );
  assert.equal(pending.evidence.playbackVerified, false);
  assert.equal(
    applyUnlinkedObservation(pending, { ...bad, mediaURI: "ipfs://Other" }),
    null,
  );
});
