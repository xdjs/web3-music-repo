import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.VERIFY_BASE_URL || "http://127.0.0.1:4190";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [],
  checks = [];
page.on("pageerror", (error) => errors.push(error.message));
const id = "mint-songs-137-c29cbe04ae322469dc077741afa2fbccda748ae4-60000";
try {
  const response = await page.request.get(base + "/api/catalog");
  const { records } = await response.json();
  const mint = records.filter((r) => r.platform === "Mint Songs");
  assert.ok(
    mint.some((r) => r.chainId === 1) && mint.some((r) => r.chainId === 137),
  );
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(base + "/#explore");
      await page.locator("[data-clear-filters]").click();
      await page.locator('[data-filter="Mint Songs"]').click();
      await page.evaluate(
        (t) => (document.documentElement.dataset.theme = t),
        theme,
      );
      assert.equal(
        (await page.locator(".results").innerText()).replace(/,/g, ""),
        `${mint.length} records`,
      );
      await page.locator('[data-facet="network"]').selectOption("137");
      assert.equal(
        (await page.locator(".results").innerText()).replace(/,/g, ""),
        `${mint.filter((r) => r.chainId === 137).length} records`,
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.goto(`${base}/#record/${id}`);
      await page
        .getByRole("heading", { name: "SHUT IT OFF", exact: true })
        .waitFor();
      assert.match(
        await page.locator(".record-head .eyebrow").innerText(),
        /POLYGON/i,
      );
      await page.evaluate(
        (t) => (document.documentElement.dataset.theme = t),
        theme,
      );
      await page.waitForTimeout(500);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.screenshot({
        path: `captures/mint-polygon-${width}-${theme}.png`,
        fullPage: true,
      });
      checks.push({ width, theme, filters: true, overflow: false });
    }
  await page.locator(`[data-play="${id}"]`).first().click();
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
  assert.deepEqual(errors, []);
  writeFileSync(
    "data/mint-songs/ui-verification.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        records: mint.length,
        polygon: mint.filter((r) => r.chainId === 137).length,
        checks,
        playback,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "MINT SONGS UI PASSED",
    JSON.stringify({ records: mint.length, playback, checks }),
  );
} finally {
  await browser.close();
}
