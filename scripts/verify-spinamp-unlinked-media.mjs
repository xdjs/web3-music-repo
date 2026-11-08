import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { alternateMediaURLs } from "../src/media-recovery.js";
const path =
  process.env.SPINAMP_UNLINKED_BUNDLE ||
  "work/spinamp-unlinked-candidate/recovered-media.json";
const raw = readFileSync(path),
  bundle = JSON.parse(raw);
const selectors = [
  ["Sound duration known", (r) => r.platform === "Sound" && r.durationSeconds],
  [
    "Sound duration unknown",
    (r) => r.platform === "Sound" && !r.durationSeconds,
  ],
  ["Zora duration known", (r) => r.platform === "Zora" && r.durationSeconds],
  ["Zora duration unknown", (r) => r.platform === "Zora" && !r.durationSeconds],
  ["NOIZD duration known", (r) => r.platform === "NOIZD" && r.durationSeconds],
  [
    "NOIZD duration unknown",
    (r) => r.platform === "NOIZD" && !r.durationSeconds,
  ],
  [
    "Spinamp duration unknown",
    (r) => r.platform === "Spinamp" && !r.durationSeconds,
  ],
  ["Nina", (r) => r.platform === "Nina"],
];
const report = {
  checkedAt: new Date().toISOString(),
  scope:
    "Eight stratified candidate samples; native Chromium decoded playback only, not full-track audition, all-catalog availability or chain verification. At most two explicit indexed references/gateway attempts per sample.",
  bundleSha256: createHash("sha256").update(raw).digest("hex"),
  candidateRecords: bundle.records.length,
  results: [],
};
const browser = await chromium.launch();
try {
  for (const [coverage, predicate] of selectors) {
    const r = bundle.records.find(predicate);
    if (!r) continue;
    const e = bundle.evidence[r.id];
    const row = {
      coverage,
      id: r.id,
      spinampTrackId: r.spinampTrackId,
      title: r.title,
      platform: r.platform,
      indexedDuration: r.durationSeconds,
      mediaURI: e.mediaURI,
      attempts: [],
    };
    const urls = [
      ...new Set([
        e.mediaURL,
        ...(e.preservedMediaAlternatives || []).map((a) => a.url),
        ...alternateMediaURLs(e.mediaURL),
      ]),
    ].slice(0, 2);
    const page = await browser.newPage();
    for (const url of urls) {
      try {
        await page.goto("about:blank");
        await page.setContent(
          '<video muted playsinline preload="auto"></video>',
        );
        await page.evaluate((url) => {
          const m = document.querySelector("video");
          m.src = url;
          m.play().catch(() => {});
        }, url);
        await page.waitForFunction(
          () => {
            const m = document.querySelector("video");
            return (
              m.currentTime > 1 && (m.webkitAudioDecodedByteCount || 0) > 0
            );
          },
          null,
          { timeout: 15000 },
        );
        const playback = await page.evaluate(() => {
          const m = document.querySelector("video");
          return {
            currentTime: m.currentTime,
            duration: m.duration,
            readyState: m.readyState,
            audioDecodedBytes: m.webkitAudioDecodedByteCount || 0,
            videoWidth: m.videoWidth,
            videoHeight: m.videoHeight,
          };
        });
        row.status = "played";
        row.playback = playback;
        row.workingURL = url;
        row.attempts.push({ url, status: "played", ...playback });
        break;
      } catch (error) {
        row.attempts.push({
          url,
          status: "unavailable",
          error: error.message.split("\n")[0],
          state: await page
            .evaluate(() => {
              const m = document.querySelector("video");
              return m
                ? {
                    readyState: m.readyState,
                    error: m.error?.code,
                    duration: Number.isFinite(m.duration) ? m.duration : null,
                    videoWidth: m.videoWidth,
                    audioDecodedBytes: m.webkitAudioDecodedByteCount || 0,
                  }
                : null;
            })
            .catch(() => null),
        });
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
      }
    }
    row.status ||= "unavailable";
    await page.close();
    report.results.push(row);
    writeFileSync(
      "data/spinamp/unlinked-release-media-verification.json",
      JSON.stringify(report, null, 2),
    );
    console.log(
      JSON.stringify({
        id: r.id,
        coverage,
        title: r.title,
        status: row.status,
        playback: row.playback,
      }),
    );
  }
} finally {
  await browser.close();
}
report.finishedAt = new Date().toISOString();
writeFileSync(
  "data/spinamp/unlinked-release-media-verification.json",
  JSON.stringify(report, null, 2),
);
