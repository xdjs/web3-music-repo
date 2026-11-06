import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeCapture } from "../scripts/export-historical-playlists.mjs";
test("Chill n Work recovers all23 exact original IDs including activity-only tracks", () => {
  const raw = JSON.parse(
    readFileSync("evidence/sound-wayback/playlist-data.json"),
  );
  const p = normalizeCapture(
    raw,
    "https://archive.example/capture",
    "2023-01-20",
  );
  assert.equal(p.tracks.length, 23);
  assert.equal(p.tracks.filter((t) => t.missing).length, 0);
  assert.deepEqual(
    p.tracks.map((t) => t.id),
    raw.props.pageProps.shelf.trackIds,
  );
  assert.equal(p.tracks[22].title, "Jon Waltz x Tate Tucker - Safeguard");
});
test("Extra captures preserve exact order and leave unknown IDs unresolved", () => {
  const p = JSON.parse(readFileSync("data/historical-playlists.json"));
  assert.equal(p.length, 4);
  assert.deepEqual(
    p.map((x) => x.tracks.filter((t) => !t.missing).length),
    [23, 16, 14, 10],
  );
  const partial = p[1];
  assert.equal(partial.tracks.filter((t) => t.missing).length, 6);
  assert.ok(partial.tracks.filter((t) => t.missing).every((t) => !t.title));
  assert.ok(p.every((x) => x.source.startsWith("https://web.archive.org/")));
});
