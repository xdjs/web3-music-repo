import test from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import {
  playlistSnapshot,
  encodePlaylistShare,
  decodePlaylistShare,
  createPlaylistShareURL,
  shareOrCopyPlaylist,
} from "../src/playlist-share.mjs";
import { createPlaylistStore } from "../src/personal-playlists.mjs";
const sample = {
  name: "After hours 🎧",
  recordIds: ["record-one", "record-two", "record-one"],
};
const tokenFor = (data) =>
  "v1." +
  gzipSync(typeof data === "string" ? data : JSON.stringify(data)).toString(
    "base64url",
  );

test("playlist links round-trip ordered repeats and Unicode while excluding account data", async () => {
  const privateInput = {
    ...sample,
    id: "private-playlist-id",
    accountId: "private-user",
    email: "secret@example.com",
    createdAt: "private-timestamp",
    tracks: [{ url: "private://media" }],
  };
  const token = await encodePlaylistShare(privateInput);
  const decoded = await decodePlaylistShare(token);
  assert.deepEqual(decoded, { v: 1, ...sample });
  const url = new URL(
    await createPlaylistShareURL(
      privateInput,
      "https://music.example/?account=secret#me",
    ),
  );
  assert.equal(url.search, "");
  assert.match(url.pathname, /^\/share\/mix\/v1\./);
  assert.equal(url.hash, "");
  assert.equal(url.hash.includes("private"), false);
});

test("playlist links reject bad input, unsupported versions and compressed bombs", async () => {
  for (const value of [
    null,
    { name: "", recordIds: [] },
    { name: "A".repeat(101), recordIds: [] },
    { name: "x", recordIds: [null] },
    { name: "x", recordIds: ["s".repeat(201)] },
    { name: "x", recordIds: Array(5001).fill("song") },
  ])
    assert.throws(() => playlistSnapshot(value));
  for (const token of [
    "",
    "v2.abcd",
    "v1.!!!!",
    "v1.a",
    "v1." + "A".repeat(24001),
    tokenFor({ ...sample, v: 2 }),
    tokenFor("{"),
    tokenFor("x".repeat(600000)),
  ])
    await assert.rejects(() => decodePlaylistShare(token));
  await assert.rejects(() =>
    createPlaylistShareURL(sample, "javascript:alert(1)"),
  );
});

test("sharing uses native share, clipboard fallback, manual fallback and respects cancel", async () => {
  const calls = [];
  const native = await shareOrCopyPlaylist(sample, {
    baseURL: "https://music.example/",
    navigator: { share: async (data) => calls.push(data) },
  });
  assert.equal(native.status, "shared");
  assert.equal(calls[0].title, sample.name);
  const copied = await shareOrCopyPlaylist(sample, {
    baseURL: "https://music.example/",
    navigator: {
      share: async () => {
        throw Error("not supported");
      },
      clipboard: { writeText: async (url) => calls.push(url) },
    },
  });
  assert.equal(copied.status, "copied");
  assert.equal(
    await decodePlaylistShare(new URL(copied.url).pathname.split("/")[3]).then(
      (p) => p.name,
    ),
    sample.name,
  );
  const cancel = await shareOrCopyPlaylist(sample, {
    baseURL: "https://music.example/",
    navigator: {
      share: async () => {
        const error = Error("Cancelled");
        error.name = "AbortError";
        throw error;
      },
      clipboard: { writeText: async () => assert.fail("cancel must not copy") },
    },
  });
  assert.equal(cancel.status, "cancelled");
  assert.equal(
    (
      await shareOrCopyPlaylist(sample, {
        baseURL: "https://music.example/",
        navigator: {},
      })
    ).status,
    "manual",
  );
});

test("saving a shared snapshot creates an independent local list and preserves failed-save state", async () => {
  const values = new Map();
  let fail = false;
  const store = createPlaylistStore({
    getItem: (key) => values.get(key),
    setItem: (key, value) => {
      if (fail) throw Error("quota");
      values.set(key, value);
    },
  });
  const decoded = await decodePlaylistShare(await encodePlaylistShare(sample));
  const a = store.createFrom(decoded.name, decoded.recordIds),
    b = store.createFrom(decoded.name, decoded.recordIds);
  assert.notEqual(a, b);
  assert.deepEqual(store.all()[0].recordIds, sample.recordIds);
  store.update(a, (p) => ({ ...p, name: "My own edit" }));
  assert.equal(store.all()[1].name, sample.name);
  assert.equal(decoded.name, sample.name);
  fail = true;
  assert.throws(() => store.createFrom("Failed", []));
  assert.equal(store.all().length, 2);
});
