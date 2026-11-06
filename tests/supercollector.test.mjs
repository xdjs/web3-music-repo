import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeSuperRelease,
  supercollectorBundle,
} from "../src/supercollector.mjs";
const cid = "bafybeich5ykaojn5czk56wk53xkb2vn3t52smvjgwxexljjcr6toic2rvy";
const addr = "0x0b0abf42c6cd9eb5803e39988850df4756a07956";
const track = {
  id: "track-one",
  number: 1,
  name: "Public song",
  gatekeep: false,
  gatekeep_mode: "allow_all",
  released: true,
  audio: {
    cid: "ipfs://" + cid,
    url: "https://public.example/music.wav",
    type: "audio/wav",
  },
  additional_metadata: {
    bpm: "150",
    key: "Dmin",
    credits: [{ credit: "Pete Rango", type: "Producer" }],
  },
};
const release = {
  id: "release-one",
  name: "Public release",
  artist: "Artist",
  address: addr,
  chain_id: 10,
  release_date: "2024-01-01",
  tracks: [track],
  user: { email: "private@example.com" },
  user_id: "secret",
  additional_metadata: {},
};
const index = {
  id: "release-one",
  address: addr,
  slug: "public-release",
  metadata_uri: `ipfs://${cid}/{id}.json`,
  tracks: [{ id: track.id, number: 1, metadata_uri: `ipfs://${cid}/1.json` }],
};
test("public page import preserves token identity/metadata and excludes account fields", () => {
  const safe = sanitizeSuperRelease(release, index, "now", "hash");
  assert.equal(JSON.stringify(safe).includes("private@example"), false);
  assert.equal(JSON.stringify(safe).includes("secret"), false);
  const b = supercollectorBundle([safe], "now");
  assert.equal(b.records.length, 1);
  assert.equal(b.records[0].chainId, 10);
  assert.equal(b.records[0].tokenId, "1");
  assert.equal(b.records[0].musicMetadata.bpms[0], 150);
  assert.equal(b.evidence[b.records[0].id].status, "indexed");
});
test("gated, unreleased and missing access evidence never export playable media", () => {
  for (const change of [
    { gatekeep: true },
    { gatekeep_mode: "collectors_only" },
    { released: false },
    { gatekeep: undefined },
  ]) {
    const safe = sanitizeSuperRelease(
      { ...release, tracks: [{ ...track, ...change }] },
      index,
      "now",
      "hash",
    );
    assert.equal(safe.tracks[0].audio, null);
    assert.equal(safe.tracks[0].encodedAudio, null);
    assert.equal(safe.tracks[0].metadataURI, null);
    assert.equal(supercollectorBundle([safe], "now").records.length, 0);
  }
});
test("identity mismatch, missing chain and duplicate token identities fail closed", () => {
  assert.throws(() =>
    sanitizeSuperRelease({ ...release, chain_id: null }, index),
  );
  assert.throws(() => sanitizeSuperRelease({ ...release, id: "wrong" }, index));
  assert.throws(() =>
    sanitizeSuperRelease(
      { ...release, tracks: [{ ...track, number: 2 }] },
      index,
    ),
  );
  const safe = sanitizeSuperRelease(release, index, "now", "hash");
  assert.throws(() => supercollectorBundle([safe, safe], "now"));
  safe.tracks[0].metadataURI = `ipfs://${cid}/2.json`;
  assert.equal(supercollectorBundle([safe], "now").records.length, 0);
});

test("Pete identity enrichment is restricted to exact approved release and track IDs", async () => {
  const { supercollectorCredits } = await import("../src/supercollector.mjs");
  const r = {
    id: "86cd0b02-0e7e-4daa-96b2-443db45447eb",
    address: addr,
    chainId: 10,
    source: "https://release.supercollector.xyz/lil-lil-lil-lil-pete-rango",
  };
  const t = {
    id: "ab4000e7-ce4f-40f8-ac27-47f9e780dfcf",
    metadata: {
      credits: [
        { name: "Peter Arango", role: "Producer" },
        { name: "Peter Arango", role: "Writer" },
        { name: "Peter Arango", role: "Producer" },
      ],
    },
  };
  assert.deepEqual(
    supercollectorCredits(r, t).map((c) => [
      c.personId,
      c.role,
      c.creditedName,
    ]),
    [
      ["pete-rango", "Producer", "Peter Arango"],
      ["pete-rango", "Writer", "Peter Arango"],
    ],
  );
  assert.deepEqual(supercollectorCredits({ ...r, id: "other" }, t), []);
  assert.deepEqual(supercollectorCredits(r, { ...t, id: "other" }), []);
});
