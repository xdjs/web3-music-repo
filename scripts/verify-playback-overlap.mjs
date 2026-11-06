import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(25000);
const result = {
  checkedAt: new Date().toISOString(),
  production: "https://web3-music-repo.vercel.app",
  observations: [],
};
await page.addInitScript(() => {
  window.observedMedia = new Set();
  window.mediaCalls = [];
  const original = document.createElement.bind(document);
  document.createElement = function (name, ...args) {
    const node = original(name, ...args);
    if (node instanceof HTMLMediaElement) window.observedMedia.add(node);
    return node;
  };
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...args) {
    window.observedMedia.add(this);
    window.mediaCalls.push({
      action: "play",
      src: this.src,
      time: this.currentTime,
    });
    return play.apply(this, args);
  };
});
try {
  const id = "pete-zora-1-10d32bf55f5cbe66b068f2109ecf7475f0631d53-1";
  await page.goto(result.production + "/#record/" + id);
  await page.locator(`[data-play="${id}"]`).click();
  await page.waitForFunction(
    () => document.querySelector("#audio").currentTime > 0.5,
    null,
    { timeout: 45000 },
  );
  await page.locator("#audio").evaluate((a) => (a.currentTime = 108));
  await page.waitForFunction(
    () => document.querySelector("#audio").currentTime > 120,
    null,
    { timeout: 35000 },
  );
  result.observations = await page.evaluate(() =>
    [
      ...new Set([
        ...document.querySelectorAll("audio,video"),
        ...window.observedMedia,
      ]),
    ].map((a) => ({
      id: a.id,
      connected: a.isConnected,
      paused: a.paused,
      ended: a.ended,
      src: a.currentSrc || a.src,
      currentTime: a.currentTime,
      volume: a.volume,
      muted: a.muted,
      audioTracks: a.audioTracks?.length ?? null,
    })),
  );
  result.playCalls = await page.evaluate(() => window.mediaCalls);
  result.activeMedia = result.observations.filter(
    (a) => !a.paused && !a.ended && a.src,
  ).length;
  await page.locator("#toggle").click();
  result.afterPause = await page.evaluate(() =>
    [...window.observedMedia].map((a) => ({
      paused: a.paused,
      src: a.currentSrc || a.src,
    })),
  );
  assert.equal(result.activeMedia, 1);
  assert.ok(result.afterPause.every((a) => a.paused));
  result.scope =
    "Headless Chromium production reproduction, seeking to 1:48 then playing through 2:00. This checks media-element concurrency; it does not establish what the user heard or exclude an effect in the source audio.";
  await page.goto("http://127.0.0.1:4191/#record/" + id);
  await page.locator(`[data-play="${id}"]`).click();
  await page.waitForFunction(
    () => navigator.mediaSession.metadata?.title === "Planet X",
  );
  result.localMediaSession = await page.evaluate(() => ({
    title: navigator.mediaSession.metadata.title,
    artist: navigator.mediaSession.metadata.artist,
    pageTitle: document.title,
  }));
  await page.locator('[data-now-action="back"]').click();
  await page.evaluate(() => (location.hash = "#record/record-not4me"));
  await page.waitForTimeout(300);
  assert.equal(
    await page.evaluate(() => navigator.mediaSession.metadata.title),
    "Planet X",
  );
  result.metadataRemainsCurrentAcrossNavigation = true;
  result.passed = true;
} catch (error) {
  result.error = error.stack;
  result.passed = false;
  throw error;
} finally {
  writeFileSync(
    "data/playback-overlap-investigation.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}
