import test from "node:test";
import assert from "node:assert/strict";
import {
  storyMimeType,
  storyStart,
  storySource,
  boundedStoryFetch,
} from "../src/story-clip.mjs";
test("only explicit H264/AAC MP4 capability enables export", () => {
  assert.equal(
    storyMimeType({ isTypeSupported: (t) => t === "video/webm" }),
    null,
  );
  assert.match(
    storyMimeType({ isTypeSupported: (t) => t.includes("avc1,mp4a.40.2") }),
    /^video\/mp4/,
  );
});
test("excerpt bounds reject invalid/short recordings and clamp end safely", () => {
  assert.equal(storyStart(99, 100), 85);
  assert.equal(storyStart(0, 15), 0);
  for (const [start, duration] of [
    [-1, 30],
    ["no", 30],
    [0, Infinity],
    [0, 14],
  ])
    assert.throws(() => storyStart(start, duration));
});
test("source provenance follows approved playback while retaining original URI", () => {
  const record = {
    playback: {
      workingURL: "/corrected.mp4",
      sourceType: "artist-supplied-correction",
    },
    recovery: {
      mediaURL: "https://example.org/original",
      mediaURI: "ipfs://original",
    },
  };
  assert.deepEqual(storySource(record), {
    url: "/corrected.mp4",
    sourceType: "artist-supplied-correction",
    label: "Artist-supplied playback master",
    originalURI: "ipfs://original",
  });
  record.playback.sourceType = "spinamp-preserved-audio";
  assert.match(storySource(record).label, /preserved playback copy/);
  delete record.playback;
  record.recovery.status = "indexed";
  assert.match(storySource(record).label, /preserved platform index/);
});
test("bounded fetch rejects advertised oversize before reading", async () => {
  let cancelled = false;
  await assert.rejects(
    boundedStoryFetch("https://example.org/music", {
      limit: 5,
      fetchImpl: async () => ({
        ok: true,
        headers: new Headers({ "content-length": "6" }),
        body: {
          cancel: async () => {
            cancelled = true;
          },
        },
      }),
    }),
    /too large/,
  );
  assert.equal(cancelled, true);
});
test("bounded fetch stops chunked oversize and retains successful MIME bytes", async () => {
  let cancelled = false;
  await assert.rejects(
    boundedStoryFetch("https://example.org/music", {
      limit: 5,
      fetchImpl: async () => ({
        ok: true,
        headers: new Headers(),
        body: {
          getReader: () => ({
            read: async () => ({ done: false, value: new Uint8Array(6) }),
            cancel: async () => {
              cancelled = true;
            },
          }),
        },
      }),
    }),
    /too large/,
  );
  assert.equal(cancelled, true);
  const blob = await boundedStoryFetch("https://example.org/music", {
    limit: 5,
    fetchImpl: async () =>
      new Response("ok", { headers: { "content-type": "audio/mpeg" } }),
  });
  assert.equal(blob.type, "audio/mpeg");
  assert.equal(await blob.text(), "ok");
});
test("CORS failure and cancellation remain explicit failures, not empty clips", async () => {
  await assert.rejects(
    boundedStoryFetch("https://example.org/music", {
      fetchImpl: async () => {
        throw new TypeError("Failed to fetch");
      },
    }),
    /blocks browser export/,
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    boundedStoryFetch("https://example.org/music", {
      signal: controller.signal,
      fetchImpl: async (_url, options) => {
        assert.equal(options.signal.aborted, true);
        throw options.signal.reason;
      },
    }),
    { name: "AbortError" },
  );
  await assert.rejects(
    boundedStoryFetch("javascript:alert(1)"),
    /cannot be exported/,
  );
});
