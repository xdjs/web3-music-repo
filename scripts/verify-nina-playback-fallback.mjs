import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { chromium } from "playwright";
import { storageURL } from "../src/nft-reader.mjs";
const path = "data/spinamp/nina-playback-verification.json",
  report = JSON.parse(readFileSync(path)),
  inventory = JSON.parse(
    gunzipSync(readFileSync("data/spinamp/inventory.json.gz")),
  ),
  bundle = JSON.parse(
    readFileSync("work/spinamp-nina-candidate/recovered-media.json"),
  );
const browser = await chromium.launch({ headless: true });
try {
  for (const row of report.results.filter((r) => r.status !== "played")) {
    const r = bundle.records.find((r) => r.id === row.id),
      t = inventory.records.find((t) => t.id === r.spinampTrackId),
      uri = "ipfs://" + t.lossyAudioIpfsHash,
      url = storageURL(uri),
      page = await browser.newPage();
    const attempt = {
      sourceType: "spinamp-preserved-audio",
      mediaURI: uri,
      mediaURL: url,
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
      }, url);
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
      attempt.status = "played";
      attempt.playback = await page.evaluate(() => {
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
    } catch (e) {
      attempt.status = "unavailable";
      attempt.error = e.message.split("\n")[0];
    } finally {
      await page
        .evaluate(() => {
          const m = document.querySelector("video");
          m.pause();
          m.removeAttribute("src");
          m.load();
        })
        .catch(() => {});
      await page.close();
    }
    row.preservedFallback = attempt;
    writeFileSync(path, JSON.stringify(report, null, 2) + "\n");
    console.log(
      JSON.stringify({
        title: r.title,
        fallback: attempt.status,
        playback: attempt.playback,
      }),
    );
  }
} finally {
  await browser.close();
}
