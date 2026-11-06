import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const checks = [];
try {
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(
        "http://127.0.0.1:4190/#record/park-s001-imagine-13?tab=comments",
      );
      await page.locator("[data-onchain-comment]").first().waitFor();
      await page.evaluate((theme) => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem("mn-archive-theme", theme);
      }, theme);
      assert.equal(await page.locator("[data-onchain-comment]").count(), 9);
      assert.equal(
        await page.evaluate(() => document.body.scrollWidth <= innerWidth),
        true,
      );
      await page.waitForTimeout(250);
      await page.locator(".tabs").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `captures/onchain-comments-${width}-${theme}.png`,
      });
      const y = await page.evaluate(() => scrollY),
        bar = (await page.locator(".tabs").boundingBox()).y;
      for (const name of ["Details", "Provenance", "Comments"]) {
        await page.getByRole("tab", { name, exact: true }).click();
        await page.waitForTimeout(150);
        assert.ok(Math.abs((await page.evaluate(() => scrollY)) - y) < 2);
        assert.ok(
          Math.abs((await page.locator(".tabs").boundingBox()).y - bar) < 2,
        );
      }
      checks.push({
        width,
        theme,
        comments: 9,
        overflow: false,
        tabScrollPreserved: true,
      });
    }
  await page.goto("http://127.0.0.1:4190/#record/record-c54c6c76?tab=comments");
  await page.getByRole("heading", { name: "From Sound’s archive" }).waitFor();
  assert.equal(await page.locator("[data-onchain-comment]").count(), 0);
  assert.ok((await page.locator(".comment-identity img").count()) > 0);
  assert.deepEqual(errors, []);
  writeFileSync(
    "data/zora-comments-ui-verification.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        checks,
        soundCommentsSeparate: true,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ checks, soundCommentsSeparate: true, errors }));
} finally {
  await browser.close();
}
