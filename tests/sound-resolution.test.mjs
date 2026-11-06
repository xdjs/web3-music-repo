import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  classifySoundSample,
  classifyLogResponse,
  parseArchivedSoundRelease,
} from "../scripts/sound-resolution-model.mjs";
test("metadata recovery failures retain the most informative surviving stage", () => {
  assert.equal(classifySoundSample({ totalMinted: "0" }), "unminted");
  assert.notEqual(
    classifySoundSample({ totalSupply: "0", totalMinted: "10" }),
    "unminted",
  );
  assert.equal(
    classifySoundSample({
      totalMinted: "10",
      metadataAttempts: [
        { metadata: { animation_url: "" } },
        { error: "HTTP429" },
      ],
    }),
    "metadata-without-supported-media",
  );
  assert.equal(
    classifySoundSample({
      totalMinted: "10",
      calls: [{ name: "tokenURI:1", error: "execution reverted" }],
    }),
    "token-uri-unavailable",
  );
  assert.equal(
    classifySoundSample({ metadataAttempts: [{ error: "HTTP404" }] }),
    "storage-unavailable",
  );
});
test("provider errors never become a successful empty scan", () => {
  assert.deepEqual(classifyLogResponse({ result: [] }), {
    status: "range-read",
    logCount: 0,
  });
  assert.equal(
    classifyLogResponse({
      error: { message: "Archive requests require a personal token" },
    }).reason,
    "archive-access-required",
  );
  assert.equal(
    classifyLogResponse({
      error: { message: "ranges over10000blocks are not supported" },
    }).status,
    "unavailable",
  );
  assert.equal(
    classifyLogResponse({ result: [], error: { message: "timeout" } }).status,
    "unavailable",
  );
});
test("archived release audio requires exact contract, chain and track identity", () => {
  const e = JSON.parse(
    fs.readFileSync(
      new URL(
        "../data/sound-resolution/mija-wayback-evidence.json",
        import.meta.url,
      ),
    ),
  );
  const html =
    '<meta name="og:audio" content="' +
    e.mediaURL +
    '"><script id="__NEXT_DATA__" type="application/json">' +
    JSON.stringify({
      props: {
        pageProps: { releaseData: { data: { mintedRelease: e.release } } },
      },
    }) +
    "</script>";
  assert.equal(parseArchivedSoundRelease(html, e).mediaURL, e.mediaURL);
  assert.throws(
    () => parseArchivedSoundRelease(html, { ...e, chainId: 1 }),
    /does not match/,
  );
  assert.throws(
    () =>
      parseArchivedSoundRelease(html, {
        ...e,
        contract: "0x" + "0".repeat(40),
      }),
    /does not match/,
  );
  assert.throws(
    () =>
      parseArchivedSoundRelease(
        html.replace(
          e.release.track.id,
          "00000000-0000-0000-0000-000000000000",
        ),
        e,
      ),
    /does not match/,
  );
  assert.throws(
    () =>
      parseArchivedSoundRelease(
        html.replace("d2i9ybouka0ieh.cloudfront.net", "127.0.0.1"),
        e,
      ),
    /Unexpected/,
  );
});
