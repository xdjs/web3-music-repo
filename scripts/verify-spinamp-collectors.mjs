import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.VERIFY_BASE_URL || "http://127.0.0.1:4191",
  id = "spinamp-c4fbf6953ce75fd2a410";
const receipt = {
  checkedAt: new Date().toISOString(),
  base,
  recordId: id,
  cases: [],
};
const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${base}/#record/${id}?tab=collectors`);
    await page
      .getByRole("heading", { name: "Indexed collectors", exact: true })
      .waitFor();
    assert.equal(
      await page.locator(".collector-grid .collector-card").count(),
      13,
    );
    assert.match(
      await page.locator(".song-collectors").innerText(),
      /16 mapped editions/,
    );
    assert.match(
      await page.locator(".song-collectors").innerText(),
      /index’s update time is unknown/,
    );
    assert.equal(await page.locator("[data-more-collectors]").count(), 0);
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (t) => (document.documentElement.dataset.theme = t),
        theme,
      );
      await page.waitForTimeout(150);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.locator(".song-collectors").screenshot({
        path: `captures/spinamp-collectors-${width}-${theme}.png`,
      });
      receipt.cases.push({
        width,
        theme,
        wallets: 13,
        editions: 16,
        overflow: false,
      });
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  writeFileSync(
    "data/spinamp/collectors-ui-verification.json",
    JSON.stringify(receipt, null, 2) + "\n",
  );
  console.log(JSON.stringify(receipt));
} finally {
  await browser.close();
}
