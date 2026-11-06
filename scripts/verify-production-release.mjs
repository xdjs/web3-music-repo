import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { createPlaylistShareURL } from "../src/playlist-share.mjs";
const base = "https://web3-music-repo.vercel.app";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(base + "/#explore");
  await page.locator(".filter-toolbar").waitFor();
  assert.equal(await page.locator(".filter-toolbar select").count(), 4);
  assert.equal(
    await page.locator('.sidebar [data-nav="artists"]').innerText(),
    "Artists",
  );
  assert.equal(
    await page.locator('.sidebar [data-nav="artists"] svg').count(),
    1,
  );
  checks.push("Live navigation SVG icons, Artists label, four visible filters");
  const breakdown =
    "recovered-sound-1-b2cb781aa0b35aec7acef3f9751b61505fd5715a";
  const driving = "mint-songs-1-2b5426a5b98a3e366230eba9f95a24f09ae4a584-7";
  const share = await createPlaylistShareURL(
    { name: "Production playback check", recordIds: [breakdown, driving] },
    base,
  );
  await page.goto(share);
  await page
    .getByRole("heading", { name: "Production playback check", exact: true })
    .waitFor();
  assert.equal(await page.locator(".personal-track").count(), 2);
  assert.equal(await page.locator("[data-remove-track]").count(), 0);
  await page.locator("[data-play-snapshot]").first().click();
  await page.waitForFunction(
    () => document.querySelector("#audio").currentTime > 1,
    null,
    { timeout: 60000 },
  );
  const playback = await page.locator("#audio").evaluate((a) => ({
    time: a.currentTime,
    duration: a.duration,
    readyState: a.readyState,
    source: a.currentSrc,
  }));
  assert.equal(await page.locator("#player-title").innerText(), "Breakdown");
  await page.locator("#next").click();
  await page.waitForFunction(
    () => document.querySelector("#player-title").textContent === "Driving",
  );
  await page.waitForFunction(
    () => document.querySelector("#audio").currentTime > 0.5,
    null,
    { timeout: 60000 },
  );
  checks.push(
    "Shared snapshot opens read-only, plays original Breakdown and next Driving in order",
  );
  await page.locator("#audio").evaluate((a) => a.pause());
  await page.locator("[data-save-snapshot]").click();
  await page.locator("[data-rename-playlist]").waitFor();
  assert.equal(await page.locator(".personal-track").count(), 2);
  checks.push("Shared snapshot saves independent local copy");
  await page.goto(base + "/#historic-playlists");
  await page.locator(".historical-playlist-picker").waitFor();
  assert.equal(await page.locator(".historical-playlist-picker a").count(), 4);
  assert.match(
    await page.locator(".playlist-feature").innerText(),
    /Chill n Work/,
  );
  assert.equal(await page.locator(".track-row").count(), 23);
  assert.equal(await page.locator(".track-row [data-play]").count(), 23);
  checks.push(
    "Four historical playlists surface; Chill n Work has 23 rows and 23 playable token matches",
  );
  await page.screenshot({
    path: "captures/production-historic-playlist.png",
    fullPage: true,
  });
  const cover = await page.request.get(base + "/lab-cover.png");
  assert.equal(cover.status(), 200);
  assert.match(cover.headers()["content-type"], /image\/png/);
  assert.deepEqual(errors, []);
  const report = {
    checkedAt: new Date().toISOString(),
    base,
    deployment: process.env.RELEASE_DEPLOYMENT_ID || null,
    sourceCommit: process.env.RELEASE_SOURCE_COMMIT || null,
    passed: true,
    checks,
    playback,
    errors,
  };
  writeFileSync(
    "data/production-release-ui-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
