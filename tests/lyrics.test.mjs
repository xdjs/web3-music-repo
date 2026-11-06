import test from "node:test";
import assert from "node:assert/strict";
import {
  extractMusicMetadata,
  extractLyrics,
  LYRICS_BYTE_LIMIT,
} from "../src/extract-music-metadata.mjs";
import { renderLyrics } from "../src/lyrics-ui.mjs";
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
test("lyric roots preserve lines, deduplicate repeated documents and retain distinct variants", () => {
  const r = extractMusicMetadata({
    lyrics: "  Test line one\r\n\r\nTest line two  ",
    body: { lyrics: { text: "Test line one\n\nTest line two" } },
    properties: { lyrics: { text: "Alternate test line" } },
  });
  assert.equal(r.lyrics.length, 2);
  assert.equal(r.lyrics[0].text, "Test line one\n\nTest line two");
  assert.equal(r.lyrics[1].field, "properties.lyrics");
  assert.equal(r.hasLyrics, true);
});
test("links, placeholders and oversized payloads are not presented as recovered lyrics", () => {
  for (const lyrics of [
    "",
    false,
    null,
    {},
    "N/A",
    "instrumental",
    "[instrumental]",
    "lyrics unavailable",
  ])
    assert.equal(extractLyrics({ lyrics }).hasLyrics, undefined);
  const ref = extractLyrics({ lyrics: "https://example.com/lyrics" });
  assert.equal(ref.hasLyrics, undefined);
  assert.equal(ref.lyricsReferences.length, 1);
  assert.equal(
    extractLyrics({ lyrics: "界".repeat(LYRICS_BYTE_LIMIT / 2) })
      .lyricsOmittedReason,
    "text-exceeds-100kb-limit",
  );
  assert.equal(
    extractLyrics({ lyrics: "a".repeat(LYRICS_BYTE_LIMIT) }).lyrics[0].text
      .length,
    LYRICS_BYTE_LIMIT,
  );
});
test("renderer escapes lyrics and validates source links; no markup or javascript execution", () => {
  const metadata = {
    lyrics: [
      { text: "<img src=x onerror=alert(1)>\nline2\nline3\nline4\nline5" },
    ],
    metadataURL: "javascript:alert(1)",
  };
  const html = renderLyrics({ musicMetadata: metadata }, esc);
  assert.ok(html.includes("&lt;img"));
  assert.ok(!html.includes("<img"));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(html.includes("<details"));
  assert.ok(html.includes("Read full lyrics"));
  assert.ok(html.includes("lyrics-preview"));
  assert.equal(renderLyrics({ musicMetadata: { hasLyrics: true } }, esc), "");
});
test("short lyrics display inline and remain readable without an external source", () => {
  const html = renderLyrics(
    {
      musicMetadata: {
        lyrics: [{ text: "Synthetic test line" }],
        metadataURL: "https://example.com/metadata.json",
      },
    },
    esc,
  );
  assert.ok(html.includes("Synthetic test line"));
  assert.ok(!html.includes("<details"));
  assert.ok(html.includes("Original lyrics source"));
});

test("indexed Spinamp lyrics link their attributed index rather than implying a verified token pointer", () => {
  const html = renderLyrics(
    {
      musicMetadata: {
        lyrics: [{ text: "Synthetic index fixture" }],
        sourceType: "spinamp-indexed-metadata",
        source: "https://api.spinamp.xyz/v3/graphql",
        metadataURL: "https://example.com/unverified-token",
      },
    },
    esc,
  );
  assert.ok(html.includes("Lyrics indexed by Spinamp"));
  assert.ok(html.includes("https://api.spinamp.xyz/v3/graphql"));
  assert.ok(!html.includes("unverified-token"));
});
