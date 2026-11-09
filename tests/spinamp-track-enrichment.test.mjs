import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import {
  applyTrackEnrichment,
  indexedContentKey,
  hasExplicitAudioFormat,
  validTrackEnrichment,
} from "../src/spinamp-track-enrichment.mjs";
import { musicFacts } from "../src/music-facts.mjs";
import { createCatalogLoader } from "../src/catalog-bundle.mjs";
import { indexRecord } from "../src/catalog-presentation.mjs";
import { renderIndexedTrackMetadata } from "../src/indexed-track-metadata-ui.mjs";
const r = {
  id: "track",
  spinampTrackId: "base/X/hash",
  spinampArtistId: "ethereum/Artist",
  kind: "audio",
  personIds: ["original"],
  musicMetadata: {
    bpms: [],
    keys: [],
    credits: [],
    collaborators: [],
    details: { Description: ["Original artist text"] },
  },
};
const e = {
  mediaURI: "ipfs://ExactCID",
  mediaURL: "https://ipfs.filebase.io/ipfs/ExactCID",
};
const entry = {
  recordId: r.id,
  trackId: r.spinampTrackId,
  artistId: r.spinampArtistId,
  source: "https://api.spinamp.xyz/v3/graphql",
  sourceType: "spinamp-track-index",
  onchainVerified: false,
  checkedAt: "2026-11-08T04:42:00Z",
  sourcePage: "data/spinamp/processed-track-metadata/001.json.gz",
  sourcePageSha256: "a".repeat(64),
  sourceRowSha256: "b".repeat(64),
  description: "Alternative indexed notes\nBPM: 105\nKey: C# minor",
  processedMediaURIs: ["ipfs://ExactCID"],
  audioMimeType: "video/mp4",
  supportingArtist: {
    id: "ethereum/Guest",
    name: "Guest",
    sourceField: "supportingArtist",
    roleNotEstablished: true,
  },
};
test("fills absent supplied facts and preserves verbatim original facts/notes and exact supporting artist identity", () => {
  const before = structuredClone(r);
  const result = applyTrackEnrichment(r, e, entry, [
    { id: "guest", spinampArtistId: "ethereum/Guest" },
  ]);
  assert.deepEqual(r, before);
  assert.equal(result.musicMetadata, r.musicMetadata);
  assert.equal(result.indexedTrackMetadata.description, entry.description);
  assert.equal(result.kind, "video");
  assert.equal(result.indexedMediaType.mediaURI, e.mediaURL);
  assert.deepEqual(result.personIds, ["original", "guest"]);
  assert.equal(musicFacts(result).bpm, 105);
  assert.equal(musicFacts(result).key, "C# minor");
  assert.match(musicFacts(result).source, /Spinamp indexed description/);
  assert.equal(indexRecord(result, e).musicFacts.bpm, 105);
  assert.match(indexRecord(result, e).searchCredits, /Guest/);
});
test("original supplied values, ambiguity and estimates retain honest precedence", () => {
  for (const bpms of [[90], [90, 100]]) {
    const result = applyTrackEnrichment(
      { ...r, musicMetadata: { ...r.musicMetadata, bpms, keys: ["D minor"] } },
      e,
      entry,
    );
    assert.equal(result.indexedMusicalFacts, undefined);
    assert.equal(musicFacts(result).bpm, bpms.length === 1 ? 90 : null);
    assert.equal(musicFacts(result).key, "D minor");
  }
  const estimated = applyTrackEnrichment(
    { ...r, audioAnalysis: { status: "estimated", bpm: 70 } },
    e,
    entry,
  );
  assert.equal(musicFacts(estimated).bpm, 105);
  const indexedKeyOnly = applyTrackEnrichment(
    { ...r, audioAnalysis: { status: "estimated", bpm: 70 } },
    e,
    { ...entry, description: "Key: C# minor" },
  );
  assert.equal(musicFacts(indexedKeyOnly).bpm, 70);
  assert.match(musicFacts(indexedKeyOnly).source, /^BPM estimated/);
  assert.match(musicFacts(indexedKeyOnly).source, /Key from a Spinamp/);

  const conflicting = applyTrackEnrichment(
    { ...r, note: "BPM: 90\nBPM: 100\nKey: D minor\nKey: E minor" },
    e,
    entry,
  );
  assert.equal(musicFacts(conflicting).bpm, null);
  assert.equal(musicFacts(conflicting).key, null);
  const original = applyTrackEnrichment({ ...r, note: "BPM: 90" }, e, entry);
  assert.equal(musicFacts(original).bpm, 90);
  assert.match(musicFacts(original).source, /other shown values retain/);
});
test("fails closed on track, artist, source, proof, scalar, and support identity mismatches", () => {
  for (const change of [
    { trackId: "base/X/other" },
    { artistId: "ethereum/artist" },
    { source: "https://example.com" },
    { onchainVerified: true },
    { sourceRowSha256: "invalid" },
    { description: "x".repeat(1048577) },
    { audioMimeType: "text/html" },
    { processedMediaURIs: ["javascript:alert(1)"] },
    { supportingArtist: { id: "a", name: "Guest", roleNotEstablished: false } },
  ]) {
    assert.equal(validTrackEnrichment(r, { ...entry, ...change }), false);
    assert.equal(applyTrackEnrichment(r, e, { ...entry, ...change }), r);
  }
  const ambiguity = applyTrackEnrichment(r, e, entry, [
    { id: "guest1", spinampArtistId: "ethereum/Guest" },
    { id: "guest2", spinampArtistId: "ethereum/Guest" },
  ]);
  assert.equal(ambiguity.indexedTrackMetadata.supportingArtist.personId, null);
  assert.deepEqual(ambiguity.personIds, ["original"]);
});
test("MIME is exact selected-asset bound and does not replace artist or preserved-copy overrides", () => {
  for (const modified of [
    { ...r, playback: { workingURL: "https://arweave.net/Other" } },
    { ...r, playbackOverride: {} },
    { ...r, playbackCopy: {} },
    {
      ...r,
      playback: {
        sourceType: "artist-supplied-correction",
        workingURL: e.mediaURL,
      },
    },
  ])
    assert.equal(applyTrackEnrichment(modified, e, entry).kind, "audio");
  assert.equal(
    applyTrackEnrichment(r, { mediaURI: "ipfs://exactcid" }, entry).kind,
    "audio",
  );
  assert.equal(
    applyTrackEnrichment({ ...r, kind: "video" }, e, {
      ...entry,
      audioMimeType: "audio/wav",
    }).kind,
    "video",
  );
  assert.equal(
    applyTrackEnrichment(
      r,
      { mediaURI: "ipfs://Other", mediaURL: "https://x.test/ipfs/ExactCID" },
      entry,
    ).kind,
    "audio",
  );
  assert.equal(
    applyTrackEnrichment(
      r,
      { mediaURI: "ipfs://Other", mediaURL: "https://ipfs.io/ipfs/ExactCID" },
      entry,
    ).kind,
    "video",
  );
});
test("separate notes renderer escapes all source text, preserves line breaks and uses native approved disclosure", () => {
  const value = applyTrackEnrichment(r, e, {
    ...entry,
    description: "<script>alert(1)</script>\nNext line",
    supportingArtist: {
      ...entry.supportingArtist,
      name: "<img onerror=alert(1)>",
    },
  });
  const esc = (s) =>
    String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  const html = renderIndexedTrackMetadata(value, esc);
  assert.match(html, /<details class="artist-sources"/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>|<img/);
  assert.match(html, /\nNext line/);
  assert.match(html, /may differ from the original/);
});
test("runtime overlay remains exact-source reproducible and preserves every original catalog record", () => {
  const data = JSON.parse(readFileSync("data/spinamp/track-enrichment.json"));
  const baseline = createCatalogLoader({ trackEnrichment: false })();
  const enriched = createCatalogLoader()();
  assert.equal(enriched.records.length, 50633);
  assert.deepEqual(
    enriched.records.map((v) => v.id),
    baseline.records.map((v) => v.id),
  );
  const pages = new Map();
  const counts = {
    descriptions: 0,
    bpms: 0,
    keys: 0,
    supportingArtists: 0,
    supportingArtistProfileLinks: 0,
    videoCorrections: 0,
  };
  const byId = new Map(baseline.records.map((r) => [r.id, r]));
  for (const record of enriched.records) {
    const original = byId.get(record.id);
    assert.deepEqual(record.musicMetadata, original.musicMetadata);
    assert.deepEqual(record.playback, original.playback);
    for (const field of [
      "contract",
      "chainId",
      "mint",
      "tokenId",
      "artist",
      "artistId",
      "spinampArtistId",
      "spinampTrackId",
      "assetType",
      "mintStatus",
    ])
      assert.equal(record[field], original[field]);
    if (record.indexedTrackMetadata?.description) counts.descriptions++;
    if (record.indexedMusicalFacts?.bpm) counts.bpms++;
    if (record.indexedMusicalFacts?.key) counts.keys++;
    if (record.indexedTrackMetadata?.supportingArtist)
      counts.supportingArtists++;
    if (record.indexedTrackMetadata?.supportingArtist?.personId)
      counts.supportingArtistProfileLinks++;
    if (record.indexedMediaType) counts.videoCorrections++;
  }
  for (const [id, proof] of Object.entries(data.records)) {
    if (!pages.has(proof.sourcePage)) {
      const raw = gunzipSync(readFileSync(proof.sourcePage));
      const receipt = JSON.parse(raw);
      assert.equal(
        createHash("sha256").update(raw).digest("hex"),
        proof.sourcePageSha256,
      );
      pages.set(
        proof.sourcePage,
        new Map(
          receipt.body.data.allProcessedTracks.nodes.map((v) => [v.id, v]),
        ),
      );
    }
    const source = pages.get(proof.sourcePage).get(proof.trackId);
    assert.equal(
      createHash("sha256").update(JSON.stringify(source)).digest("hex"),
      proof.sourceRowSha256,
    );
    if (proof.description !== null)
      assert.equal(proof.description, source.description);
    assert.equal(proof.artistId, source.artistId);
    assert.equal(proof.audioMimeType, source.lossyAudioMimeType);
    assert.equal(validTrackEnrichment(byId.get(id), proof), true);
  }
  for (const [name, count] of Object.entries(counts))
    assert.equal(count, data.counts[name], name);
  assert.deepEqual(counts, {
    descriptions: 13273,
    bpms: 12,
    keys: 1,
    supportingArtists: 7,
    supportingArtistProfileLinks: 7,
    videoCorrections: 13279,
  });
  assert.deepEqual(enriched.evidence, baseline.evidence);
});

test("queries remain part of storage identity, including ext/id hints and transform requests", () => {
  for (const query of ["?format=mp3", "?ext=mp3", "?id=42"]) {
    for (const [url, uri] of [
      ["https://ipfs.io/ipfs/ExactCID", "ipfs://ExactCID"],
      ["https://www.arweave.net/ExactTx", "ar://ExactTx"],
    ]) {
      assert.notEqual(indexedContentKey(url + query), indexedContentKey(uri));
      assert.notEqual(indexedContentKey(uri + query), indexedContentKey(uri));
      assert.equal(
        indexedContentKey(url + query),
        indexedContentKey(uri + query),
      );
    }
    assert.equal(
      applyTrackEnrichment(r, { mediaURL: e.mediaURL + query }, entry).kind,
      "audio",
    );
    assert.equal(
      applyTrackEnrichment(
        r,
        { mediaURL: e.mediaURL + query },
        { ...entry, processedMediaURIs: ["ipfs://ExactCID" + query] },
      ).kind,
      query === "?id=42" ? "video" : "audio",
    );
  }
  assert.notEqual(
    indexedContentKey("ar://ExactTx?format=mp3"),
    indexedContentKey("ar://ExactTx?format=wav"),
  );
  assert.notEqual(
    indexedContentKey("https://ipfs.io/ipfs/ExactCID?format=mp3&ext=mp3"),
    indexedContentKey("ipfs://ExactCID?format=mp3"),
  );
});

test("explicit selected audio extension or format hint holds a new video claim without downgrading existing video", () => {
  const base = "https://www.arweave.net/ExactTx";
  const hints = [
    "?ext=mp3",
    "?format=wav",
    "?EXT=.FLAC",
    "?format=audio%2Fmpeg",
    "?ext=mp4&ext=ogg",
  ];
  const paths = [
    "/song.mp3",
    "/song.WAV",
    "/song.m4a",
    "/song%2Emp3",
    "/song.aiff",
    "/song.opus",
    "/song.aac",
  ];
  for (const suffix of [...hints, ...paths]) {
    const selected = base + suffix;
    assert.equal(hasExplicitAudioFormat(selected), true, selected);
    const bound = { ...entry, processedMediaURIs: [selected] };
    const result = applyTrackEnrichment(r, { mediaURL: selected }, bound);
    assert.equal(result.kind, "audio", selected);
    assert.equal(result.indexedMediaType, undefined);
    assert.equal(result.indexedTrackMetadata.description, entry.description);
    assert.equal(
      applyTrackEnrichment(
        { ...r, kind: "video" },
        { mediaURL: selected },
        bound,
      ).kind,
      "video",
    );
  }
  for (const value of [
    base,
    base + "?ext=mp4",
    base + "/song.mp4",
    base + "?title=mp3",
    base + "?format=video%2Fmp4",
  ])
    assert.equal(hasExplicitAudioFormat(value), false, value);
  const nina =
    "https://www.arweave.net/RPNpKcRSE3d-jUjswOsMTZFgKvykuj7esy2g9CW7R80?ext=mp3";
  assert.equal(
    applyTrackEnrichment(
      r,
      { mediaURL: nina },
      { ...entry, processedMediaURIs: [nina] },
    ).kind,
    "audio",
  );
});
