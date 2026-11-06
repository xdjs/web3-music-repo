import { chromium, webkit } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.ARCHIVE_QA_URL || "http://127.0.0.1:4191";
const id = "recovered-sound-10-1bfc0624b52e870cc00d4e39995c75c7da8763d3";
const report = {
  checkedAt: new Date().toISOString(),
  base,
  checks: [],
  views: [],
  errors: [],
};
try {
  for (const [engine, width] of [
    [chromium, 1440],
    [webkit, 390],
  ]) {
    const browser = await engine.launch({ headless: true });
    try {
      const touch = width === 390;
      const page = await browser.newPage({
        viewport: { width, height: touch ? 844 : 1000 },
        hasTouch: touch,
        isMobile: touch,
      });
      page.setDefaultTimeout(20000);
      page.on("pageerror", (error) => report.errors.push(error.message));
      await page.goto(base + "/#record/" + id);
      const start = page.locator(`[data-play="${id}"]`);
      if (touch) await start.tap();
      else await start.click();
      const dialog = page.locator("#now-playing-dialog");
      const back = dialog.getByRole("button", {
        name: "Back to discovery",
        exact: true,
      });
      await page.waitForFunction(
        () => document.querySelector("#audio").currentTime > 0.3,
        null,
        { timeout: 45000 },
      );
      assert.equal(await back.locator("svg").count(), 1);
      assert.equal(await back.innerText(), "");
      assert.equal(
        await back.evaluate((node) => getComputedStyle(node).outlineStyle),
        "none",
      );
      assert.equal(
        await dialog
          .locator('[data-now="source"],[data-now-action="record"]')
          .count(),
        0,
      );
      assert.equal(
        await dialog.locator('[data-now="volume"]').isVisible(),
        !touch,
      );
      assert.equal(await dialog.locator('[data-now="seek"]').isVisible(), true);
      assert.equal(
        await dialog.locator('[data-now="mute"]').isVisible(),
        !touch,
      );
      assert.equal(await page.locator("#player-source").innerText(), "");
      for (const viewport of touch ? [390, 320] : [1440])
        for (const theme of ["light", "dark"]) {
          await page.setViewportSize({
            width: viewport,
            height: touch ? 844 : 1000,
          });
          await page.evaluate(
            (theme) => (document.documentElement.dataset.theme = theme),
            theme,
          );
          await page.waitForFunction(
            () => {
              const art = document.querySelector('[data-now="art"]');
              return art.complete && art.naturalWidth > 0;
            },
            null,
            { timeout: 20000 },
          );
          assert.ok(
            await dialog.evaluate(
              (node) => node.scrollWidth <= node.clientWidth,
            ),
          );
          await page.screenshot({
            path: `captures/now-playing-refinement-${viewport}-${theme}.png`,
          });
          report.views.push({
            engine: touch ? "webkit" : "chromium",
            width: viewport,
            theme,
            volumeVisible: !touch,
            noOverflow: true,
          });
        }
      const before = await page
        .locator("#audio")
        .evaluate((a) => ({ time: a.currentTime, src: a.currentSrc }));
      if (touch) await back.tap();
      else await back.click();
      await page.waitForTimeout(200);
      const after = await page.locator("#audio").evaluate((a) => ({
        time: a.currentTime,
        src: a.currentSrc,
        paused: a.paused,
      }));
      assert.ok(after.time > before.time);
      assert.equal(after.src, before.src);
      assert.equal(after.paused, false);
      assert.equal(await dialog.evaluate((node) => node.open), false);
      report.checks.push(
        `${touch ? "Touch WebKit" : "Desktop Chromium"}: no touch/pointer close focus ring; clean chevron; correct volume visibility; Back preserves real playback`,
      );

      // Keyboard users keep visible focus, wrapping and focus return.
      const opener = page.locator("#player-title");
      await opener.focus();
      await page.keyboard.press("Enter");
      assert.equal(await dialog.evaluate((node) => node.open), true);
      assert.equal(
        await back.evaluate((node) => node === document.activeElement),
        true,
      );
      assert.equal(
        await back.evaluate((node) => getComputedStyle(node).outlineStyle),
        "solid",
      );
      await page.keyboard.press("Shift+Tab");
      assert.equal(
        await dialog.evaluate((node) => node.contains(document.activeElement)),
        true,
      );
      await page.keyboard.press("Tab");
      assert.equal(
        await back.evaluate((node) => node === document.activeElement),
        true,
      );
      await page.keyboard.press("Escape");
      assert.equal(await dialog.evaluate((node) => node.open), false);
      assert.equal(
        await opener.evaluate((node) => node === document.activeElement),
        true,
      );
      assert.equal(
        await opener.evaluate((node) => getComputedStyle(node).outlineStyle),
        "solid",
      );
      report.checks.push(
        `${touch ? "WebKit" : "Chromium"}: keyboard focus ring, Shift+Tab/Tab wrap, Escape and original focus return verified`,
      );
    } finally {
      await browser.close();
    }
  }
  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.error = error.stack;
  throw error;
} finally {
  writeFileSync(
    "data/now-playing-mobile-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
}
