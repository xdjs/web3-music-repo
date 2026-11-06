import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
const base = process.env.BASE_URL || "http://127.0.0.1:4190";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [],
  checks = [];
page.on("pageerror", (error) => errors.push(error.message));
mkdirSync("captures", { recursive: true });
try {
  const response = await page.request.get(`${base}/api/catalog`);
  assert.equal(response.status(), 200);
  const catalog = await response.json();
  const record = catalog.records.find(
    (r) =>
      r.chainId === 1 &&
      r.contract.toLowerCase() ===
        "0x0bc2a24ce568dad89691116d5b34deb6c203f342" &&
      r.tokenId === "986",
  );
  assert.ok(
    record?.royaltyPayments?.length,
    "Harmless Thrash requires attached verified royalty events",
  );
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${base}/#record/${record.id}`);
      const section = page.locator("[data-royalty-payments]");
      await section.waitFor();
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      assert.equal(
        await section.locator("h2").innerText(),
        "Recorded royalty payouts",
      );
      assert.match(await section.innerText(), /0\.01 ETH/);
      assert.match(await section.innerText(), /not the artist’s net income/);
      assert.doesNotMatch(await section.innerText(), /0\.11 ETH|0\.1 ETH/);
      const summary = section.locator("summary");
      if (!(await section.locator("details").evaluate((el) => el.open))) {
        await summary.focus();
        await summary.press("Enter");
      }
      assert.equal(
        await section.locator("details").evaluate((el) => el.open),
        true,
      );
      assert.match(await section.innerText(), /wrapped ETH/);
      assert.ok(
        await section.locator('a[href^="https://etherscan.io/tx/"]').count(),
      );
      assert.ok(
        await section
          .locator('a[href^="https://etherscan.io/address/"]')
          .count(),
      );
      const style = await section.locator("h2").evaluate((el) => {
        const ref = document.querySelector(".reading > h2");
        const own = getComputedStyle(el),
          shared = getComputedStyle(ref);
        return {
          ownSize: own.fontSize,
          sharedSize: shared.fontSize,
          ownFont: own.fontFamily,
          sharedFont: shared.fontFamily,
        };
      });
      assert.equal(style.ownSize, style.sharedSize);
      assert.equal(style.ownFont, style.sharedFont);
      await section.evaluate((element) =>
        element.scrollIntoView({ block: "center" }),
      );
      await page.waitForTimeout(100);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "No horizontal overflow",
      );
      await page.screenshot({
        path: `captures/royalty-payments-${width}-${theme}.png`,
      });
      checks.push({
        width,
        theme,
        exactAmount: true,
        keyboardDisclosure: true,
        sourceLinks: true,
        sharedTypography: true,
        overflow: false,
      });
    }
  assert.deepEqual(errors, []);
  const report = {
    checkedAt: new Date().toISOString(),
    base,
    record: record.id,
    checks,
    errors,
  };
  writeFileSync(
    "data/royalty-ui-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
