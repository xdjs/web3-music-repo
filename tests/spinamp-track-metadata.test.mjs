import test from "node:test";
import assert from "node:assert/strict";
import {
  TRACK_SNAPSHOT_FIELDS,
  validateTrackMetadataPage,
  trackMetadataCounts,
} from "../src/spinamp-track-metadata.mjs";
const row = {
  id: "Track/A",
  title: "Title",
  artistId: "Artist/Case",
  platformId: "sound",
  platformInternalId: "same",
  lossyAudioUrl: "https://arweave.net/audio",
  lossyAudioIpfsHash: "QmAudio",
  lossyArtworkUrl: "https://arweave.net/art",
  lossyArtworkIpfsHash: "QmArt",
  description: "Preserved\nverbatim notes.",
  lossyAudioMimeType: "audio/wav",
  lossyArtworkMimeType: "image/png",
  chorusStart: "0.00",
  supportingArtist: null,
  artistBySupportingArtist: null,
};
const snap = new Map([
  [row.id, Object.fromEntries(TRACK_SNAPSHOT_FIELDS.map((k) => [k, row[k]]))],
]);
const body = (r) => ({
  data: {
    allProcessedTracks: {
      totalCount: 1,
      pageInfo: { hasNextPage: false, endCursor: "end" },
      nodes: [r],
    },
  },
});
test("exact identity and source media snapshot bind preserved descriptions/MIME without musical fact inference", () => {
  const result = validateTrackMetadataPage(body(row), { snapshot: snap });
  assert.equal(result.rows[0].status, "matched");
  assert.equal(result.page.nodes[0].description, row.description);
  const counts = trackMetadataCounts([row]);
  assert.equal(counts.descriptions, 1);
  assert.equal(counts.nonzeroChorusStart, 0);
  assert.equal(Object.hasOwn(counts, "bpm"), false);
});
test("changed source artist/media is quarantined and unknown tracks do not enter frozen cohort", () => {
  for (const key of [
    "artistId",
    "lossyAudioUrl",
    "lossyAudioIpfsHash",
    "title",
  ]) {
    const result = validateTrackMetadataPage(
      body({ ...row, [key]: "changed" }),
      { snapshot: snap },
    );
    assert.equal(result.rows[0].status, "snapshot-changed");
    assert.deepEqual(result.rows[0].mismatches, [key]);
  }
  assert.equal(
    validateTrackMetadataPage(body({ ...row, id: "Track/a" }), {
      snapshot: snap,
    }).rows[0].status,
    "outside-frozen-snapshot",
  );
});
test("provider errors, malformed pagination and repeated IDs fail closed", () => {
  assert.throws(
    () =>
      validateTrackMetadataPage(
        { errors: [{ message: "quota" }] },
        { snapshot: snap },
      ),
    /quota/,
  );
  const p = body(row);
  p.data.allProcessedTracks.pageInfo = { hasNextPage: true, endCursor: "same" };
  assert.throws(
    () => validateTrackMetadataPage(p, { snapshot: snap, after: "same" }),
    /repeated/,
  );
  assert.throws(
    () =>
      validateTrackMetadataPage(body(row), {
        snapshot: snap,
        seen: new Set([row.id]),
      }),
    /repeated/,
  );
  const d = body(row);
  d.data.allProcessedTracks.nodes.push(row);
  assert.throws(
    () => validateTrackMetadataPage(d, { snapshot: snap }),
    /repeated/,
  );
});
test("declared scalar types and exact supporting-artist relation are enforced", () => {
  for (const changed of [
    { description: {} },
    { lossyAudioMimeType: [] },
    { chorusStart: 1 },
    { chorusStart: "NaN" },
    {
      supportingArtist: "Artist/A",
      artistBySupportingArtist: { id: "Artist/B", name: "Name", slug: null },
    },
  ])
    assert.throws(() =>
      validateTrackMetadataPage(body({ ...row, ...changed }), {
        snapshot: snap,
      }),
    );
  const r = {
    ...row,
    chorusStart: "45.20",
    supportingArtist: "Artist/B",
    artistBySupportingArtist: { id: "Artist/B", name: "Name", slug: null },
  };
  assert.equal(
    validateTrackMetadataPage(body(r), { snapshot: snap }).rows[0].status,
    "matched",
  );
  assert.equal(trackMetadataCounts([r]).supportingArtists, 1);
  assert.equal(trackMetadataCounts([r]).nonzeroChorusStart, 1);
});
