import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.ARCHIVE_QA_URL || "http://127.0.0.1:4191";
const preserved = "spinamp-94ba38fe64af02a6ebd6",
  original = "spinamp-c4fbf6953ce75fd2a410";
const browser = await chromium.launch({ headless: true }),
  page = await browser.newPage(),
  errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript(
        (t) => localStorage.setItem("mn-archive-theme", t),
        theme,
      );
      await page.goto(
        base + `/?qa=spinamp-${width}-${theme}#record/${preserved}?tab=proof`,
      );
      await page.locator(".provenance").waitFor();
      const panel = page.locator("[role=tabpanel]");
      assert.match(await panel.innerText(), /audio may be transcoded/);
      assert.match(
        await panel.innerText(),
        /not independently verified onchain/,
      );
      assert.match(await panel.innerText(), /Spinamp preserved audio/);
      assert.equal(
        await panel
          .getByRole("link", { name: "Open original", exact: true })
          .count(),
        0,
      );
      assert.equal(
        await panel.getByRole("link", { name: "Open Spinamp audio" }).count(),
        1,
      );
      await page.locator(".reading").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `captures/spinamp-provenance-${width}-${theme}.png`,
      });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.goto(base + `/#record/${original}?tab=proof`);
      await page.locator(".provenance").waitFor();
      assert.match(await panel.innerText(), /Indexed NFT media/);
      assert.match(
        await panel.innerText(),
        /has not been independently checked/,
      );
      checks.push({
        width,
        theme,
        preservedAudioLabel: true,
        transcodeScope: true,
        independentChainReadNotClaimed: true,
        indexedOriginalLabel: true,
        noOverflow: true,
      });
    }
  assert.deepEqual(errors, []);
  const result = {
    checkedAt: new Date().toISOString(),
    base,
    preserved,
    original,
    checks,
    errors,
  };
  writeFileSync(
    "data/spinamp/ui-verification.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
