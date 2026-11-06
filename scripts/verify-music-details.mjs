import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const browser = await chromium.launch({ headless: true }),
  page = await browser.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  const catalog = await (
    await page.request.get("http://127.0.0.1:4190/api/catalog")
  ).json();
  const earned = catalog.records.find((r) => r.revenue),
    estimated = catalog.records.find(
      (r) =>
        r.audioAnalysis?.status === "estimated" &&
        !r.musicMetadata?.bpms?.length,
    ),
    chaos = catalog.records.find((r) => r.id === "chaos-song-4733");
  assert.ok(earned && estimated && chaos);
  const checks = [];
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`http://127.0.0.1:4190/#record/${chaos.id}`);
      await page.locator(".music-facts").waitFor();
      await page.evaluate(
        (t) => (document.documentElement.dataset.theme = t),
        theme,
      );
      await page.waitForTimeout(250);
      assert.match(await page.locator(".music-facts").innerText(), /120 BPM/);
      assert.match(await page.locator(".music-facts").innerText(), /E Major/);
      assert.match(
        await page.locator("[role=tabpanel]").innerText(),
        /Three Oscillators/,
      );
      await page.locator(".music-facts").scrollIntoViewIfNeeded();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.screenshot({
        path: `captures/music-metadata-${width}-${theme}.png`,
      });
      await page.goto(`http://127.0.0.1:4190/#record/${earned.id}`);
      await page.locator(".song-revenue").waitFor();
      await page.locator(".song-revenue summary").click();
      assert.match(
        await page.locator(".song-revenue").innerText(),
        /Partial recovery/,
      );
      assert.ok(
        (await page
          .locator('.song-revenue a[href*="basescan.org/tx/"]')
          .count()) > 0,
      );
      await page.locator(".song-revenue").scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.screenshot({
        path: `captures/song-revenue-${width}-${theme}.png`,
      });
      checks.push({
        width,
        theme,
        metadata: true,
        revenue: true,
        overflow: false,
      });
    }
  const soundKey = catalog.records.find(
    (r) => r.platform === "Sound" && r.musicMetadata?.keys?.length === 1,
  );
  assert.ok(soundKey);
  await page.goto(`http://127.0.0.1:4190/#record/${soundKey.id}`);
  await page.locator(".music-facts").waitFor();
  assert.ok(
    (await page.locator(".music-facts").innerText()).includes(
      soundKey.musicMetadata.keys[0],
    ),
  );
  await page.goto(`http://127.0.0.1:4190/#record/${estimated.id}`);
  await page.locator(".music-facts").waitFor();
  assert.match(
    await page.locator(".music-facts").innerText(),
    /estimated by Open BPM/,
  );
  assert.match(await page.locator(".music-facts").innerText(), /~\d/);
  await page.goto("http://127.0.0.1:4190/#me");
  await page.locator(".profile-account-card").waitFor();
  assert.ok(
    !(await page.locator("#profile-account").innerText()).includes(
      "Account connection loading",
    ),
  );
  assert.deepEqual(errors, []);
  writeFileSync(
    "data/music-details-ui-verification.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        checks,
        estimatedLabel: true,
        profilePlaceholderCleared: true,
        errors,
      },
      null,
      2,
    ),
  );
  console.log("MUSIC DETAILS", JSON.stringify(checks));
} finally {
  await browser.close();
}
