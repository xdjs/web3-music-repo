import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { createCatalogLoader } from "../src/catalog-bundle.mjs";
import { alternateMediaURLs } from "../src/media-recovery.js";
const base = process.env.VERIFY_BASE_URL || "http://127.0.0.1:4301";
const report = {
  checkedAt: new Date().toISOString(),
  base,
  scope:
    "Isolated overlay UI and five bounded native-video samples. Indexed MIME for all other records remains unverified. No full-track audition, onchain verification, media transformations or writes.",
  overlaySha256: createHash("sha256")
    .update(readFileSync("data/spinamp/track-enrichment.json"))
    .digest("hex"),
  ui: [],
  media: [],
  status: "running",
};
mkdirSync("captures", { recursive: true });
const catalog = createCatalogLoader()();
const browser = await chromium.launch();
try {
  for (const [width, height, theme] of [
    [1440, 1000, "light"],
    [1440, 1000, "dark"],
    [390, 844, "light"],
    [390, 844, "dark"],
  ]) {
    const context = await browser.newContext({ viewport: { width, height } });
    await context.addInitScript(
      (theme) => localStorage.setItem("mn-archive-theme", theme),
      theme,
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base + "/#record/spinamp-558584f480721454bc7a", {
      waitUntil: "domcontentloaded",
    });
    const panel = page.locator("[data-indexed-track-notes]");
    await panel.waitFor({ timeout: 60000 });
    assert.equal(await panel.getAttribute("open"), null);
    await panel.locator("summary").click();
    await page.locator(".music-facts").waitFor();
    const facts = await page.locator(".music-facts").innerText();
    assert.match(facts, /105 BPM/);
    assert.match(facts, /C# minor/);
    assert.match(facts, /Spinamp indexed description/);
    const record = catalog.records.find(
      (r) => r.id === "spinamp-558584f480721454bc7a",
    );
    assert.equal(
      await panel.locator(".original-release-notes").textContent(),
      record.indexedTrackMetadata.description,
    );
    await panel.scrollIntoViewIfNeeded();
    const dimensions = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      theme: document.documentElement.dataset.theme,
    }));
    assert.ok(dimensions.scrollWidth <= width + 1);
    assert.equal(dimensions.theme, theme);
    assert.deepEqual(errors, []);
    await page.screenshot({
      path: `captures/track-enrichment-${width}-${theme}.png`,
      fullPage: true,
    });
    await page.goto(base + "/#record/spinamp-d438cfec532170eb7efe", {
      waitUntil: "domcontentloaded",
    });
    const support = page.locator("[data-indexed-track-notes]");
    await support.waitFor({ timeout: 60000 });
    await support.locator("summary").click();
    assert.match(await support.innerText(), /Supporting artist: Reo Cragun/);
    assert.equal(
      await support.locator('a[href^="#artist/"]').getAttribute("href"),
      "#artist/spinamp-artist-35525cdb2d1e5fdb60a8",
    );
    report.ui.push({
      width,
      height,
      theme,
      status: "passed",
      consoleErrors: errors,
    });
    await context.close();
  }
  const selectors = [
    [
      "Zora mp4",
      (r) =>
        r.platform === "Zora" && r.indexedMediaType?.mimeType === "video/mp4",
    ],
    [
      "NOIZD mp4",
      (r) =>
        r.platform === "NOIZD" && r.indexedMediaType?.mimeType === "video/mp4",
    ],
    [
      "Nina mp4",
      (r) =>
        r.platform === "Nina" && r.indexedMediaType?.mimeType === "video/mp4",
    ],
    ["QuickTime", (r) => r.indexedMediaType?.mimeType === "video/quicktime"],
    ["M4V", (r) => r.indexedMediaType?.mimeType === "video/x-m4v"],
  ];
  for (const [sample, predicate] of selectors) {
    const r = catalog.records.find(predicate);
    if (!r) {
      report.media.push({ sample, status: "no-candidate" });
      continue;
    }
    const evidence = catalog.evidence[r.id];
    const primary = r.playback?.workingURL || evidence.mediaURL;
    const urls = [...new Set([primary, ...alternateMediaURLs(primary)])]
      .filter(Boolean)
      .slice(0, 2);
    const result = {
      sample,
      id: r.id,
      title: r.title,
      trackId: r.spinampTrackId,
      mimeType: r.indexedMediaType.mimeType,
      sourceRowSha256: r.indexedMediaType.sourceRowSha256,
      selectedURI: r.indexedMediaType.mediaURI,
      attempts: [],
      status: "unverified",
    };
    const page = await browser.newPage();
    for (const url of urls) {
      await page.goto("about:blank");
      await page.setContent('<video muted playsinline preload="auto"></video>');
      await page.evaluate((url) => {
        const v = document.querySelector("video");
        v.src = url;
        v.play().catch(() => {});
      }, url);
      let error = null;
      try {
        await page.waitForFunction(
          () => {
            let v = document.querySelector("video");
            return v.videoWidth > 0 && v.currentTime > 0.5;
          },
          null,
          { timeout: 20000 },
        );
      } catch (e) {
        error = e.message.split("\n")[0];
      }
      const state = await page.evaluate(() => {
        const v = document.querySelector("video");
        return {
          time: v.currentTime,
          duration: Number.isFinite(v.duration) ? v.duration : null,
          width: v.videoWidth,
          height: v.videoHeight,
          readyState: v.readyState,
          decodedAudioBytes: v.webkitAudioDecodedByteCount ?? null,
          decodedVideoFrames: v.webkitDecodedFrameCount ?? null,
          errorCode: v.error?.code ?? null,
        };
      });
      result.attempts.push({ url, ...state, error });
      await page.evaluate(() => {
        const v = document.querySelector("video");
        v.pause();
        v.removeAttribute("src");
        v.load();
      });
      if (state.width > 0 && state.time > 0.5) {
        result.status = "decoded-video";
        break;
      }
    }
    report.media.push(result);
    await page.close();
  }
  report.status = "completed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  await browser.close();
  writeFileSync(
    "data/spinamp/processed-track-metadata/enrichment-browser-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      status: report.status,
      ui: report.ui,
      media: report.media.map((r) => ({
        sample: r.sample,
        id: r.id,
        status: r.status,
      })),
      error: report.error,
    }),
  );
}
