import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { alternateMediaURLs } from "../src/media-recovery.js";
const bundle = JSON.parse(readFileSync("data/spinamp/recovered-media.json"));
const ids = [
  "spinamp-4bff201350e878d8dcfc",
  "spinamp-073e25367a01a4e53532",
  "spinamp-5b4c2c956adbbf20e7f9",
];
const browser = await chromium.launch({ headless: true }),
  results = [],
  seen = new Map();
try {
  for (const id of ids) {
    const r = bundle.records.find((r) => r.id === id),
      e = bundle.evidence[id];
    let observation = seen.get(e.mediaURI);
    if (!observation) {
      const page = await browser.newPage(),
        attempts = [];
      const responses = [];
      page.on("response", (response) => {
        if (response.request().resourceType() === "media")
          responses.push({
            url: response.url(),
            status: response.status(),
            contentType: response.headers()["content-type"] || null,
          });
      });
      for (const url of [
        ...new Set([e.mediaURL, ...alternateMediaURLs(e.mediaURL)]),
      ].slice(0, 2)) {
        try {
          await page.goto("about:blank");
          await page.setContent(
            '<video muted playsinline preload="metadata" style="width:640px"></video>',
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
                m.currentTime > 0.4 &&
                m.readyState >= 2 &&
                m.videoWidth > 0 &&
                m.videoHeight > 0
              );
            },
            null,
            { timeout: 20000 },
          );
          const playback = await page.evaluate(() => {
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
          attempts.push({ url, status: "played", ...playback });
          observation = { status: "played", playback, attempts, responses };
          break;
        } catch (error) {
          attempts.push({
            url,
            status: "unavailable",
            error: error.message.split("\n")[0],
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
      observation ??= { status: "unavailable", attempts, responses };
      seen.set(e.mediaURI, observation);
      await page.close();
    }
    results.push({
      id,
      title: r.title,
      chainId: r.chainId,
      contract: r.contract,
      tokenId: r.tokenId,
      mediaURI: e.mediaURI,
      previousKind: r.kind,
      ...observation,
    });
  }
  const report = {
    checkedAt: new Date().toISOString(),
    scope:
      "Two exact content references, three NFT records. Actual Chromium native decoded video dimensions and advancing time; no title heuristics and no independent chain verification.",
    results,
  };
  writeFileSync(
    "data/spinamp/video-kind-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      results.map(({ id, status, playback }) => ({ id, status, playback })),
    ),
  );
} finally {
  await browser.close();
}
