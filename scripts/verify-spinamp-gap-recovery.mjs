import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { normalizeSpinampCollectorSnapshot } from "../src/spinamp-collectors.mjs";
const base = process.env.VERIFY_BASE_URL || "http://127.0.0.1:4191",
  snapshots = JSON.parse(readFileSync("data/spinamp/collector-snapshots.json"));
const report = {
  checkedAt: new Date().toISOString(),
  base,
  scope:
    "Actual local API and rendered collector UI. Indexed snapshots are not fresh onchain balances. No mocked holder responses, account writes or media playback.",
  endpoints: [],
  views: [],
};
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  for (const e of Object.values(snapshots.records)) {
    const expected = normalizeSpinampCollectorSnapshot(e),
      response = await context.request.get(
        `${base}/api/collectors/${e.recordId}`,
      );
    assert.equal(response.status(), 200);
    const data = await response.json();
    assert.equal(data.status, "indexed");
    assert.equal(data.scope, "spinamp-release-snapshot");
    assert.equal(data.indexFreshness, "unknown");
    assert.equal(data.onchainVerified, false);
    assert.equal(data.items.length, expected.items.length);
    assert.equal(data.mappedTokenCount, expected.mappedTokenCount);
    report.endpoints.push({
      recordId: e.recordId,
      wallets: data.items.length,
      editions: data.mappedTokenCount,
    });
  }
  for (const [width, theme, id] of [
    [
      1440,
      "dark",
      process.env.VERIFY_DESKTOP_RECORD || "spinamp-c51ed235413858f6cad3",
    ],
    [
      390,
      "light",
      process.env.VERIFY_MOBILE_RECORD || "spinamp-257e94565ad496224826",
    ],
  ]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(
      (t) => localStorage.setItem("mn-archive-theme", t),
      theme,
    );
    await page.goto(`${base}/#record/${id}?tab=collectors`);
    await page
      .getByRole("heading", { name: "Indexed collectors", exact: true })
      .waitFor();
    const expected = report.endpoints.find((x) => x.recordId === id);
    assert.equal(
      await page.locator(".collector-grid .collector-card").count(),
      expected.wallets,
    );
    assert.match(
      await page.locator(".song-collectors").innerText(),
      /index’s update time is unknown/,
    );
    await page
      .locator(".song-collectors")
      .evaluate((el) => el.scrollIntoView({ block: "start" }));
    await page.evaluate(() => scrollBy(0, -130));
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `${process.env.VERIFY_CAPTURE_PREFIX || "captures/spinamp-expanded-collectors"}-${width}-${theme}.png`,
    });
    assert.deepEqual(errors, []);
    report.views.push({
      width,
      theme,
      recordId: id,
      walletCards: expected.wallets,
      overflow: false,
      errors,
    });
    await page.close();
  }
  writeFileSync(
    process.env.VERIFY_RECEIPT_PATH ||
      "data/spinamp/gap-collectors-ui-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
