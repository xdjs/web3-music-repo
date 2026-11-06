import test from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { buildSharePage, sharePageOrigin } from "../src/share-pages.mjs";
import { encodePlaylistShare } from "../src/playlist-share.mjs";
const origin = "https://web3-music-archive.vercel.app";
const bundle = {
  records: [
    {
      id: "song-1",
      title: "A song #7",
      artist: "Artist One",
      artistId: "artist-1",
      platform: "Nina",
      kind: "audio",
    },
    {
      id: "song-2",
      title: "Second",
      artist: "Artist One",
      artistId: "artist-1",
    },
  ],
  people: [
    {
      id: "artist-1",
      name: "Artist One",
      portrait: { src: "/people/artist-1.webp" },
    },
  ],
  evidence: {
    "song-1": { localImage: "/recovered/song-1.webp" },
    "song-2": { imageURL: "https://arweave.net/cover" },
  },
};
const playlists = [
  {
    id: "historic-1",
    name: "Chill n Work",
    curator: "Juan",
    declaredCount: 2,
    tracks: [
      { title: "First", coverURL: "https://cdn.example.test/first.png" },
      { missing: true },
    ],
  },
];
const page = (path, extra = {}) =>
  buildSharePage({ pathname: path, origin, bundle, playlists, ...extra });
test("record social tags contain entity title and artwork and retain the exact app destination", async () => {
  const result = await page("/share/record/song-1");
  assert.equal(result.status, 200);
  assert.match(
    result.body,
    /property="og:title" content="A song — Artist One"/,
  );
  assert.match(
    result.body,
    /name="twitter:image" content="https:\/\/web3-music-archive.vercel.app\/recovered\/song-1.webp"/,
  );
  assert.equal(result.entity.destination, "/#record/song-1");
  assert.match(result.body, /location.replace\("\/#record\/song-1"\)/);
  assert.match(result.headers["Cache-Control"], /^public/);
});
test("artist social preview uses profile image and counts associated recordings", async () => {
  const result = await page("/share/artist/artist-1");
  assert.equal(result.entity.image, origin + "/people/artist-1.webp");
  assert.match(result.entity.description, /2 recovered recordings/);
  assert.equal(result.entity.destination, "/#artist/artist-1");
});
test("recovered playlist preview uses its own artwork, curator and historical route", async () => {
  const result = await page("/share/playlist/historic-1");
  assert.equal(result.entity.image, "https://cdn.example.test/first.png");
  assert.match(result.entity.description, /Juan/);
  assert.match(result.entity.description, /1 track details preserved from 2/);
  assert.equal(result.entity.destination, "/#historic-playlists/historic-1");
});
test("personal snapshot preview exposes only supplied public selection and omits private account fields", async () => {
  const token = await encodePlaylistShare({
    name: "My night mix",
    recordIds: ["missing", "song-1"],
    accountId: "PRIVATE",
  });
  const result = await page("/share/mix/" + token);
  assert.equal(result.status, 200);
  assert.equal(result.entity.image, origin + "/recovered/song-1.webp");
  assert.match(result.entity.description, /2 entries; 1 currently matched/);
  assert.equal(result.entity.destination, "/#shared-playlist/" + token);
  assert.equal(result.headers["Cache-Control"], "no-store");
  assert.match(result.body, /noindex, nofollow/);
  assert.doesNotMatch(result.body, /PRIVATE|accountId/);
});
test("unknown, malformed, oversized and decompression bomb shares fail without generic success", async () => {
  const bomb = "v1." + gzipSync(Buffer.alloc(600000, 65)).toString("base64url");
  for (const path of [
    "/share/record/unknown",
    "/share/artist/unknown",
    "/share/playlist/unknown",
    "/share/record/%ZZ",
    "/share/record/%2Fsecret",
    "/share/mix/v1.invalid",
    "/share/mix/" + bomb,
    "/share/mix/" + "a".repeat(25000),
  ])
    assert.equal((await page(path)).status, 404, path.slice(0, 40));
});
test("metadata text is escaped and unsafe artwork URLs fall back without becoming fetch targets", async () => {
  const hostile = {
    records: [
      {
        id: "hostile",
        title: "</script><img src=x onerror=alert(1)>",
        artist: 'A" onload="bad',
        imageURI: "javascript:alert(1)",
      },
    ],
    people: [],
    evidence: {},
  };
  const result = await page("/share/record/hostile", { bundle: hostile });
  assert.equal(result.status, 200);
  assert.match(result.body, /&lt;\/script&gt;/);
  assert.doesNotMatch(result.body, /<img src=x|javascript:|onload="bad/);
  assert.match(result.body, /social\/web3-music-archive-v1.png/);
  assert.equal((result.body.match(/<script>/g) || []).length, 1);
});
test("share origin rejects forwarded or arbitrary host influence and permits exact local development host", () => {
  assert.equal(sharePageOrigin(undefined, "evil.test"), origin);
  assert.equal(sharePageOrigin(undefined, "localhost.evil.test"), origin);
  assert.equal(
    sharePageOrigin(undefined, "127.0.0.1:4191"),
    "http://127.0.0.1:4191",
  );
  assert.equal(
    sharePageOrigin("https://trusted.example/", "evil.test"),
    "https://trusted.example",
  );
  assert.equal(
    sharePageOrigin("https://user:pass@evil.test/", "evil.test"),
    origin,
  );
});
