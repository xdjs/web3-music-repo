import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { createCatalogLoader } from "../src/catalog-bundle.mjs";
import { alternateMediaURLs } from "../src/media-recovery.js";
const base = process.env.VERIFY_BASE_URL;
if (!base) throw Error("VERIFY_BASE_URL is required");
const prefix = process.env.VERIFY_OUTPUT_PREFIX || "track-enrichment";
assert.match(prefix, /^[a-z0-9-]+$/);
const report = {
  checkedAt: new Date().toISOString(),
  base,
  scope:
    "Staged overlay UI, five bounded native-video samples and two actual app player selections. Indexed MIME for all other records remains unverified. No full-track audition, onchain verification, media transformations or writes.",
  overlaySha256: createHash("sha256")
    .update(readFileSync("data/spinamp/track-enrichment.json"))
    .digest("hex"),
  sourceCommit: process.env.RELEASE_SOURCE_COMMIT || null,
  appMedia: [],
  ui: [],
  media: [],
  status: "running",
};
mkdirSync("captures", { recursive: true });
const catalog = createCatalogLoader()();
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(60000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base + "/#record/spinamp-558584f480721454bc7a", {
    waitUntil: "commit",
  });
  await page.locator("[data-indexed-track-notes]").waitFor({ timeout: 60000 });
  for (const [width, height, theme] of [
    [1440, 1000, "light"],
    [1440, 1000, "dark"],
    [390, 844, "light"],
    [390, 844, "dark"],
  ]) {
    await page.setViewportSize({ width, height });
    if (
      (await page.evaluate(() => document.documentElement.dataset.theme)) !==
      theme
    )
      await page.locator("#theme").click();
    await page.evaluate(() => {
      location.hash = "record/spinamp-558584f480721454bc7a";
    });
    await page
      .locator('.record-head [data-play="spinamp-558584f480721454bc7a"]')
      .waitFor({ timeout: 30000 });
    const panel = page.locator("[data-indexed-track-notes]");
    await panel.waitFor({ timeout: 60000 });
    if ((await panel.getAttribute("open")) === null)
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
      path: `captures/${prefix}-${width}-${theme}.png`,
      fullPage: true,
    });
    await page.goto(base + "/#record/spinamp-d438cfec532170eb7efe", {
      waitUntil: "domcontentloaded",
    });
    await page
      .locator('.record-head [data-play="spinamp-d438cfec532170eb7efe"]')
      .waitFor({ timeout: 30000 });
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
  }
  const selectors = [
    [
      "Zora mp4",
      (r) =>
        r.platform === "Zora" && r.indexedMediaType?.mimeType === "video/mp4",
    ],
    [
      "SongADay mp4",
      (r) =>
        r.platform === "songaday.world" &&
        r.indexedMediaType?.mimeType === "video/mp4",
    ],
    [
      "Nina mp4",
      (r) =>
        r.platform === "Nina" && r.indexedMediaType?.mimeType === "video/mp4",
    ],
    [
      "omgkirby mp4",
      (r) =>
        r.platform === "omgkirby" &&
        r.indexedMediaType?.mimeType === "video/mp4",
    ],
    [
      "QuickTime or M4V",
      (r) =>
        ["video/quicktime", "video/x-m4v"].includes(
          r.indexedMediaType?.mimeType,
        ),
    ],
  ];
  for (const [sample, predicate] of selectors) {
    const r = catalog.records.find(predicate);
    if (!r) {
      report.media.push({ sample, status: "no-candidate" });
      continue;
    }
    const response = await context.request.get(
      base + "/api/record/" + encodeURIComponent(r.id),
      { timeout: 30000 },
    );
    assert.equal(response.status(), 200);
    const remote = (await response.json()).record;
    assert.equal(remote.kind, "video");
    assert.equal(
      remote.indexedMediaType.sourceRowSha256,
      r.indexedMediaType.sourceRowSha256,
    );
    assert.equal(remote.indexedMediaType.mediaURI, r.indexedMediaType.mediaURI);
    const evidence = catalog.evidence[r.id];
    assert.equal(
      remote.playback?.workingURL || remote.recovery.mediaURL,
      r.playback?.workingURL || evidence.mediaURL,
    );
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
  for (const sample of report.media.filter((r) =>
    ["SongADay mp4", "omgkirby mp4"].includes(r.sample),
  )) {
    const result = {
      id: sample.id,
      sample: sample.sample,
      status: "unverified",
    };
    await page.evaluate((id) => {
      location.hash = "record/" + id;
    }, sample.id);
    await page
      .locator(`.record-head [data-play="${sample.id}"]`)
      .waitFor({ timeout: 30000 });
    assert.match(
      await page.locator(".record-head .eyebrow").innerText(),
      /VIDEO/,
    );
    await page.locator(`.record-head [data-play="${sample.id}"]`).click();
    try {
      await page.waitForFunction(
        () => {
          const v = document.querySelector("#audio");
          return v?.videoWidth > 0 && v.currentTime > 0.5 && !v.paused;
        },
        null,
        { timeout: 30000 },
      );
      result.status = "decoded-video-in-app";
    } catch (error) {
      result.error = error.message.split("\n")[0];
    }
    result.state = await page.evaluate(() => {
      const v = document.querySelector("#audio");
      return {
        src: v.currentSrc,
        time: v.currentTime,
        width: v.videoWidth,
        height: v.videoHeight,
        paused: v.paused,
        decodedVideoFrames: v.webkitDecodedFrameCount ?? null,
        decodedAudioBytes: v.webkitAudioDecodedByteCount ?? null,
        errorCode: v.error?.code ?? null,
      };
    });
    assert.equal(
      await page.locator("#player-title").getAttribute("href"),
      "#record/" + sample.id,
    );
    await page.locator("#open-now-playing").click();
    await page.locator("#now-playing-dialog[open]").waitFor();
    await page.screenshot({ path: `captures/${prefix}-app-${sample.id}.png` });
    await page.locator('[data-now-action="back"]').click();
    await page.evaluate(() => document.querySelector("#audio").pause());
    report.appMedia.push(result);
  }
  report.assessment = {
    uiViewsPassed: report.ui.length,
    decodedNativeSamples: report.media.filter(
      (r) => r.status === "decoded-video",
    ).length,
    nativeSampleCount: report.media.length,
    decodedAppSamples: report.appMedia.filter(
      (r) => r.status === "decoded-video-in-app",
    ).length,
    appSampleCount: report.appMedia.length,
  };
  report.status =
    report.assessment.decodedNativeSamples === 5 &&
    report.assessment.decodedAppSamples === 2
      ? "passed"
      : "partial-media-verification";
  if (report.status !== "passed") process.exitCode = 1;
  await context.close();
} catch (error) {
  report.status = "failed";
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  await browser.close();
  writeFileSync(
    `data/spinamp/processed-track-metadata/${prefix}-browser-verification.json`,
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
