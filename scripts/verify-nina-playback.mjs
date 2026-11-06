import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
const path =
    process.env.NINA_CANDIDATE ||
    "work/spinamp-nina-candidate/recovered-media.json",
  raw = readFileSync(path),
  bundle = JSON.parse(raw),
  rows = bundle.records.filter((r) => r.chainId === "solana");
const used = new Set(),
  samples = [];
const add = (label, filter) => {
  const record = rows.find((r) => !used.has(r.id) && filter(r));
  if (record) {
    used.add(record.id);
    samples.push({ label, record });
  }
};
add(
  "legacy nina.market positive duration",
  (r) =>
    r.originalRelease?.startsWith("https://nina.market/") &&
    r.durationSeconds > 0,
);
add(
  "legacy nina.market second artist",
  (r) =>
    r.originalRelease?.startsWith("https://nina.market/") &&
    r.durationSeconds > 0 &&
    r.artistId !== samples[0].record.artistId,
);
add(
  "ninaprotocol unknown indexed duration",
  (r) =>
    r.originalRelease?.startsWith("https://ninaprotocol.com/") &&
    !r.durationSeconds,
);
add(
  "ninaprotocol second unknown indexed duration",
  (r) =>
    r.originalRelease?.startsWith("https://ninaprotocol.com/") &&
    !r.durationSeconds,
);
add(
  "ninaprotocol positive indexed duration",
  (r) =>
    r.originalRelease?.startsWith("https://ninaprotocol.com/") &&
    r.durationSeconds > 0,
);
add(
  "2024+ indexed release",
  (r) => r.indexedSourceDate?.date >= "2024-" && r.durationSeconds > 0,
);
if (samples.length !== 6) throw Error("Expected six stratified candidates");
const browser = await chromium.launch({ headless: true }),
  results = [];
try {
  for (const { label, record: r } of samples) {
    const e = bundle.evidence[r.id],
      page = await browser.newPage(),
      responses = [];
    page.on("response", (response) => {
      if (response.request().resourceType() === "media")
        responses.push({
          url: response.url(),
          status: response.status(),
          contentType: response.headers()["content-type"] || null,
        });
    });
    const result = {
      id: r.id,
      title: r.title,
      artist: r.artist,
      label,
      chainId: r.chainId,
      mint: r.mint,
      originalRelease: r.originalRelease,
      mediaURI: e.mediaURI,
      mediaURL: e.mediaURL,
      indexedDuration: r.durationSeconds,
      indexedMimeType: e.mediaEvidence?.indexedMimeType,
      onchainVerified: false,
    };
    try {
      await page.goto("about:blank");
      await page.setContent(
        '<video muted playsinline preload="metadata"></video>',
      );
      await page.evaluate((url) => {
        const m = document.querySelector("video");
        m.src = url;
        m.play().catch(() => {});
      }, e.mediaURL);
      await page.waitForFunction(
        () => {
          const m = document.querySelector("video");
          return (
            m.currentTime > 0.5 && (m.webkitAudioDecodedByteCount || 0) > 0
          );
        },
        null,
        { timeout: 25000 },
      );
      result.status = "played";
      result.playback = await page.evaluate(() => {
        const m = document.querySelector("video");
        return {
          currentTime: m.currentTime,
          duration: m.duration,
          readyState: m.readyState,
          audioDecodedBytes: m.webkitAudioDecodedByteCount || 0,
          videoDecodedBytes: m.webkitVideoDecodedByteCount || 0,
          videoWidth: m.videoWidth,
          videoHeight: m.videoHeight,
        };
      });
    } catch (error) {
      result.status = "unavailable";
      result.error = error.message.split("\n")[0];
    } finally {
      await page
        .evaluate(() => {
          const m = document.querySelector("video");
          if (m) {
            m.pause();
            m.removeAttribute("src");
            m.load();
          }
        })
        .catch(() => {});
      await page.close();
    }
    result.responses = responses;
    results.push(result);
    writeFileSync(
      "data/spinamp/nina-playback-verification.json",
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          scope:
            "Six source-indexed Nina samples across both public-link eras, including two unknown indexed durations and one 2024+ entry. Real Chromium startup audio decode plus video dimensions. No all-track availability, full-song audition, or independent Solana chain verification claim.",
          bundleSha256: createHash("sha256").update(raw).digest("hex"),
          candidateSolanaRecords: rows.length,
          results,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      JSON.stringify({
        label,
        title: r.title,
        status: result.status,
        playback: result.playback,
      }),
    );
  }
} finally {
  await browser.close();
}
