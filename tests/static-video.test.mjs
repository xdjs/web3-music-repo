import test from "node:test";
import assert from "node:assert/strict";
import { videoByteRange, serveStaticVideo } from "../src/static-video.mjs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
test("video range parsing handles explicit/open/suffix ranges and rejects invalid or multiple ranges", () => {
  assert.deepEqual(videoByteRange("bytes=0-4", 10), { start: 0, end: 4 });
  assert.deepEqual(videoByteRange("bytes=5-", 10), { start: 5, end: 9 });
  assert.deepEqual(videoByteRange("bytes=-3", 10), { start: 7, end: 9 });
  assert.deepEqual(videoByteRange("bytes=8-100", 10), { start: 8, end: 9 });
  for (const v of [
    "bytes=10-",
    "bytes=5-3",
    "bytes=-0",
    "bytes=0-1,3-4",
    "bytes=-",
    "items=0-1",
    "bytes=999999999999999999999-",
  ])
    assert.equal(videoByteRange(v, 10), null);
});
test("local video HTTP responses preserve exact range bytes, HEAD length and invalid-range status", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music-video-test-")),
    file = join(dir, "video.mp4");
  await writeFile(file, Buffer.from("0123456789"));
  const server = createServer((req, res) => serveStaticVideo(req, res, file));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = "http://127.0.0.1:" + server.address().port;
  try {
    const range = await fetch(url, { headers: { Range: "bytes=2-5" } });
    assert.equal(range.status, 206);
    assert.equal(range.headers.get("content-type"), "video/mp4");
    assert.equal(range.headers.get("content-range"), "bytes 2-5/10");
    assert.equal(await range.text(), "2345");
    const head = await fetch(url, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get("content-length"), "10");
    assert.equal(await head.text(), "");
    const bad = await fetch(url, { headers: { Range: "bytes=10-20" } });
    assert.equal(bad.status, 416);
    assert.equal(bad.headers.get("content-range"), "bytes */10");
    const full = await fetch(url, {
      headers: { Range: "bytes=2-5", "If-Range": "stale" },
    });
    assert.equal(full.status, 200);
    assert.equal(await full.text(), "0123456789");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true });
  }
});
