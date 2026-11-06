import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.ARCHIVE_QA_URL || "http://127.0.0.1:4191",
  id = "pete-zora-1-0e616dff8c4d9341ce7cebe3bfa829d76ddb410e-3";
const browser = await chromium.launch({ headless: true }),
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
  errors = [],
  checks = [],
  profileRequests = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (r.url().includes("/api/collector/")) profileRequests.push(r.url());
});
try {
  await page.goto(`${base}/#record/${id}?tab=collectors`);
  const panel = page.locator(
    `[data-collector-panel="${id}"][data-full="true"]`,
  );
  await panel.locator(".collector-card").first().waitFor({ timeout: 40000 });
  await page.waitForFunction(
    (id) =>
      document
        .querySelector(`[data-collector-panel="${id}"][data-full="true"]`)
        ?.querySelectorAll(".collector-card").length === 7,
    id,
    { timeout: 30000 },
  );
  assert.equal(await panel.locator(".collector-card").count(), 7);
  assert.match(await panel.innerText(), /media-matched index snapshot/);
  await page.waitForTimeout(1200);
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(
        (t) => (document.documentElement.dataset.theme = t),
        theme,
      );
      await panel.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `captures/collectors-recovered-${width}-${theme}.png`,
      });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      assert.equal(overflow, false);
      checks.push({
        width,
        theme,
        holders: await panel.locator(".collector-card").count(),
        overflow,
      });
    }
  const profileImages = await panel.locator(".collector-avatar img").count();
  assert.ok(profileRequests.length > 0);
  assert.deepEqual(errors, []);
  const report = {
    checkedAt: new Date().toISOString(),
    base,
    id,
    scope:
      "Actual Say it celly media-matched index response and existing collector identity/PFP enrichment pipeline; no invented portraits or complete historical-minter claim.",
    checks,
    profileRequests: [...new Set(profileRequests)],
    profileImages,
    errors,
  };
  writeFileSync(
    "data/collector-ui-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
