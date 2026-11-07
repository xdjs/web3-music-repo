import { chromium, webkit } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.BASE_URL || "http://127.0.0.1:4191";
const report = {
  checkedAt: new Date().toISOString(),
  scope:
    "Actual app in Chromium and WebKit mobile viewport/touch emulation. Computed type size, focus/typing/blur and layout verified; physical iOS keyboard autozoom is not established by this test.",
  checks: [],
  physicalIOSAutoZoomVerified: false,
  status: "running",
};
try {
  for (const [name, engine] of Object.entries({ chromium, webkit })) {
    const browser = await engine.launch({ headless: true });
    try {
      const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base + "/#explore", { waitUntil: "domcontentloaded" });
      await page.locator(".record-card").first().waitFor({ timeout: 45000 });
      const viewport = await page
        .locator("meta[name=viewport]")
        .getAttribute("content");
      assert.doesNotMatch(viewport, /maximum-scale|user-scalable\s*=\s*no/i);
      for (const theme of ["light", "dark"]) {
        await page.evaluate(
          (theme) => (document.documentElement.dataset.theme = theme),
          theme,
        );
        const input = page.locator("#search");
        const font = await input.evaluate((e) =>
          parseFloat(getComputedStyle(e).fontSize),
        );
        assert.ok(font >= 16);
        await input.focus();
        await input.fill("Pete Rango");
        assert.equal(
          await input.evaluate((e) => document.activeElement === e),
          true,
        );
        await page.waitForTimeout(150);
        const focused = await page.evaluate(() => ({
          scale: visualViewport?.scale,
          viewportWidth: visualViewport?.width,
          overflow: document.body.scrollWidth > innerWidth,
        }));
        assert.equal(focused.overflow, false);
        await page.screenshot({
          path: `captures/mobile-input-${name}-${theme}-focused.png`,
        });
        await input.blur();
        const blurred = await page.evaluate(() => ({
          scale: visualViewport?.scale,
          viewportWidth: visualViewport?.width,
          overflow: document.body.scrollWidth > innerWidth,
        }));
        assert.equal(blurred.overflow, false);
        report.checks.push({
          engine: name,
          theme,
          searchFontPx: font,
          focused,
          blurred,
          viewport,
        });
      }
      await page.goto(
        base +
          "/#record/pete-zora-1-10d32bf55f5cbe66b068f2109ecf7475f0631d53-1",
      );
      await page.locator("[data-story-export]").waitFor();
      await page.locator("[data-story-export]").click();
      await page.waitForFunction(
        () =>
          !document.querySelector("[data-story-start]").disabled ||
          document
            .querySelector("[data-story-status]")
            .classList.contains("notice"),
        null,
        { timeout: 60000 },
      );
      for (const theme of ["light", "dark"]) {
        await page.evaluate(
          (theme) => (document.documentElement.dataset.theme = theme),
          theme,
        );
        await page.locator(".story-exact summary").click();
        const input = page.locator("[data-story-start]");
        const font = await input.evaluate((e) =>
          parseFloat(getComputedStyle(e).fontSize),
        );
        assert.ok(font >= 16);
        const enabled = await input.isEnabled();
        assert.equal(
          enabled,
          true,
          await page.locator("[data-story-status]").innerText(),
        );
        await input.focus();
        await input.fill("100");
        await input.blur();
        const overflow = await page.evaluate(
          () => document.body.scrollWidth > innerWidth,
        );
        assert.equal(overflow, false);
        await page.waitForTimeout(250);
        await page.screenshot({
          path: `captures/mobile-story-input-${name}-${theme}.png`,
        });
        report.checks.push({
          engine: name,
          theme,
          storyInputFontPx: font,
          overflow,
        });
      }
      await page.locator("[data-story-close]").click();
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  }
  report.status = "passed";
} catch (e) {
  report.status = "failed";
  report.error = e.stack;
  throw e;
} finally {
  writeFileSync(
    "data/mobile-input-focus-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
