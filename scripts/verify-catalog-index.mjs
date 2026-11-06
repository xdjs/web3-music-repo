import { chromium } from "playwright";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { writeFileSync } from "node:fs";
const base = process.env.ARCHIVE_QA_URL || "http://127.0.0.1:4191";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [],
  requests = [],
  checks = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => {
  if (
    request.url().includes("/api/catalog") ||
    request.url().includes("/api/record/")
  )
    requests.push(request.url());
});
try {
  const fullResponse = await page.request.get(base + "/api/catalog");
  assert.equal(fullResponse.status(), 200);
  const fullText = await fullResponse.text(),
    full = JSON.parse(fullText);
  const indexResponse = await page.request.get(
    base + "/api/catalog?view=index",
  );
  assert.equal(indexResponse.status(), 200);
  const indexText = await indexResponse.text(),
    index = JSON.parse(indexText);
  assert.equal(index.records.length, full.records.length);
  assert.equal(
    index.records.find((r) => r.id === "record-69c77ef0").originalRelease,
    full.records.find((r) => r.id === "record-69c77ef0").originalRelease,
  );
  assert.ok(indexText.length < fullText.length * 0.6);
  assert.equal(
    (
      await page.request.get(base + "/api/catalog?view=index", {
        headers: { "If-None-Match": indexResponse.headers().etag },
      })
    ).status(),
    304,
  );
  assert.equal(
    (await page.request.get(base + "/api/record/missing-record")).status(),
    404,
  );
  const chaos = full.records.find((r) => r.id === "chaos-song-4733");
  const earned = full.records.find((r) => r.revenue);
  assert.ok(chaos && earned);
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript(
        (t) => localStorage.setItem("mn-archive-theme", t),
        theme,
      );
      await page.goto(base + `/?qa=${width}-${theme}#record/` + chaos.id);
      await page.locator(".music-facts").waitFor();
      assert.match(await page.locator(".music-facts").innerText(), /120 BPM/);
      assert.match(
        await page.locator("[role=tabpanel]").innerText(),
        /Three Oscillators/,
      );
      await page.locator('[data-tab="proof"]').click();
      await page.locator(".provenance").waitFor();
      assert.match(
        await page.locator(".provenance").innerText(),
        new RegExp(chaos.contract, "i"),
      );
      assert.equal(
        await page.locator("#audio").evaluate((a) => a.paused),
        true,
      );
      await page.screenshot({
        path: `captures/catalog-index-${width}-${theme}.png`,
      });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.goto(base + "/#record/" + earned.id);
      await page.locator(".song-revenue").waitFor();
      assert.match(
        await page.locator(".song-revenue").innerText(),
        /verified artist payouts/,
      );
      checks.push({
        width,
        theme,
        credits: true,
        musicFacts: true,
        provenance: true,
        revenue: true,
        noAutoplay: true,
        noOverflow: true,
      });
    }
  // Controlled network conditions test loading, retries and late responses separately from real data checks above.
  let release;
  const delayed = new Promise((resolve) => (release = resolve));
  await page.route("**/api/record/" + chaos.id, async (route) => {
    await delayed;
    await route.continue();
  });
  await page.goto(base + "/?qa=delayed#record/" + chaos.id);
  await page.getByText("Loading recording details…").waitFor();
  await page.locator('[data-tab="proof"]').click();
  await page.evaluate(() => (location.hash = "explore"));
  await page.getByRole("heading", { name: "Explore the archive" }).waitFor();
  release();
  await page.waitForResponse((response) =>
    response.url().endsWith("/api/record/" + chaos.id),
  );
  await page.waitForTimeout(150);
  assert.equal(await page.locator(".record-head").count(), 0);
  await page.unroute("**/api/record/" + chaos.id);
  let fail = true;
  await page.route("**/api/record/" + earned.id, async (route) => {
    if (fail) {
      fail = false;
      await route.fulfill({
        status: 503,
        json: { error: "Temporary test failure" },
      });
    } else await route.continue();
  });
  await page.goto(base + "/?qa=retry#record/" + earned.id);
  await page.locator("[data-retry-record]").waitFor();
  await page.locator("[data-retry-record]").click();
  await page.locator(".song-revenue").waitFor();
  await page.unroute("**/api/record/" + earned.id);
  const before = await page.locator(".record-head").boundingBox();
  await page.locator('[data-tab="proof"]').click();
  await page.locator(".provenance").waitFor();
  const after = await page.locator(".record-head").boundingBox();
  assert.equal(before.y, after.y);
  await page.goto(base + "/#historic-playlists");
  await page.getByRole("heading", { name: "Playlists from the era" }).waitFor();
  const chill = page
    .locator(".historical-playlist-picker a")
    .filter({ hasText: "Chill" })
    .first();
  await chill.click();
  await page.waitForTimeout(150);
  assert.equal(await page.locator(".track-row [data-play]").count(), 23);
  // Original audio starts directly from compact index without a record-detail request.
  await page.goto(base + "/#explore");
  await page.locator("#search").fill("Breakdown");
  const play = page.locator(
    '[data-play="recovered-sound-1-b2cb781aa0b35aec7acef3f9751b61505fd5715a"]',
  );
  await play.click();
  await page.waitForFunction(
    () => {
      const a = document.querySelector("#audio");
      return !a.paused && a.currentTime > 0.5 && a.readyState >= 2;
    },
    {},
    { timeout: 45000 },
  );
  const playback = await page.locator("#audio").evaluate((a) => ({
    currentTime: a.currentTime,
    readyState: a.readyState,
    source: a.currentSrc,
  }));
  await page.locator("#audio").evaluate((a) => a.pause());
  assert.ok(
    !requests.some(
      (url) => new URL(url).pathname === "/api/catalog" && !new URL(url).search,
    ),
  );
  assert.deepEqual(errors, []);
  const result = {
    checkedAt: new Date().toISOString(),
    base,
    records: index.records.length,
    fullBytes: Buffer.byteLength(fullText),
    indexBytes: Buffer.byteLength(indexText),
    fullGzip: gzipSync(fullText).length,
    indexGzip: gzipSync(indexText).length,
    checks,
    lateResponseIgnored: true,
    retryAfter503: true,
    sameSongHeaderStable: true,
    etag304: true,
    unknown404: true,
    historicalPlaylistMatches: 23,
    playback,
    errors,
  };
  writeFileSync(
    "data/catalog-index-verification.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
