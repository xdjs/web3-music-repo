import test from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { indexRecord, presentRecord } from "../src/catalog-presentation.mjs";
import { createCatalogLoader } from "../src/catalog-bundle.mjs";
import { musicFacts } from "../src/music-facts.mjs";
import { compareReleaseDates } from "../src/release-date.mjs";

test("index keeps original media and relationships but leaves full provenance and credits to record details", () => {
  const record = {
    id: "example",
    title: "Song",
    artist: "Artist",
    personIds: ["artist"],
    credits: [
      { personId: "mixer", role: "Mix", source: "https://example.org/credit" },
    ],
    note: "BPM: 120",
    originalRelease: "https://sound.xyz/artist/song",
    imageURI: "ipfs://original-art",
    releaseDate: {
      timestamp: 123,
      date: "2021-01-01",
      source: "https://example.org/mint",
      label: "Minted",
    },
    musicMetadata: {
      bpms: [],
      keys: [],
      collaborators: ["Person"],
      credits: ["Written by Person"],
      details: { Description: ["Full note"] },
    },
  };
  const evidence = {
    status: "live",
    mediaURL: "https://arweave.net/audio",
    mediaURI: "ar://audio",
    localImage: "/art.webp",
    metadataURI: "ipfs://metadata",
    metadata: { very: "large" },
    blockNumber: 12,
  };
  const full = presentRecord(record, evidence),
    index = indexRecord(record, evidence);
  assert.equal(index.recovery.mediaURL, evidence.mediaURL);
  assert.equal(index.imageURL, "/art.webp");
  assert.deepEqual(index.personIds, ["artist", "mixer"]);
  assert.equal(index.platform, "Sound");
  assert.equal(index.searchCredits, "Person Written by Person");
  assert.equal(index.musicFacts.bpm, 120);
  assert.equal(index.releaseDate.timestamp, 123);
  assert.equal(index.note, undefined);
  assert.equal(index.musicMetadata, undefined);
  assert.equal(index.recovery.metadata, undefined);
  assert.equal(full.recovery, evidence);
  assert.equal(full.musicMetadata, record.musicMetadata);
});

test("every catalog index entry retains identity, date order, musical facts and playable original URL", () => {
  const bundle = createCatalogLoader()();
  const full = bundle.records.map((r) =>
    presentRecord(r, bundle.evidence[r.id]),
  );
  const index = bundle.records.map((r) =>
    indexRecord(r, bundle.evidence[r.id]),
  );
  for (let n = 0; n < full.length; n++) {
    const source = full[n],
      compact = index[n];
    for (const key of [
      "id",
      "title",
      "artist",
      "artistId",
      "chainId",
      "contract",
      "tokenId",
      "kind",
    ])
      assert.equal(compact[key] ?? null, source[key] ?? null);
    assert.equal(
      compact.recovery?.mediaURL ?? null,
      source.recovery?.mediaURL ?? null,
    );
    assert.equal(compact.playback?.workingURL, source.playback?.workingURL);
    const facts = musicFacts(source);
    if (facts.bpm || facts.key) assert.deepEqual(compact.musicFacts, facts);
  }
  for (const order of ["oldest", "newest"])
    assert.deepEqual(
      [...index]
        .sort((a, b) => compareReleaseDates(a, b, order))
        .map((r) => r.id),
      [...full]
        .sort((a, b) => compareReleaseDates(a, b, order))
        .map((r) => r.id),
    );
  const fullJSON = JSON.stringify(full),
    indexJSON = JSON.stringify(index);
  assert.ok(indexJSON.length < fullJSON.length * 0.6);
  console.log(
    JSON.stringify({
      records: index.length,
      fullBytes: Buffer.byteLength(fullJSON),
      indexBytes: Buffer.byteLength(indexJSON),
      fullGzip: gzipSync(fullJSON).length,
      indexGzip: gzipSync(indexJSON).length,
    }),
  );
});

test("platform page music facts keep their provenance separate from token reads", () => {
  const compact = indexRecord(
    {
      id: "public-release",
      musicMetadata: {
        sourceType: "official-public-release-page",
        bpms: [75],
        keys: ["D Major"],
        credits: ["Mixer — mixing"],
        collaborators: [],
      },
    },
    { status: "indexed", contractURIRead: { status: "mismatch" } },
  );
  assert.equal(compact.recovery.status, "indexed");
  assert.equal(
    compact.musicFacts.source,
    "Official release metadata; not audio-analysis estimates",
  );
  assert.match(compact.searchCredits, /Mixer/);
});
