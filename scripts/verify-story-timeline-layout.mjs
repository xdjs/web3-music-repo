import { chromium, webkit } from "playwright";
import { PNG } from "pngjs";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.BASE_URL || "http://127.0.0.1:4191";
const id = "pete-zora-1-10d32bf55f5cbe66b068f2109ecf7475f0631d53-1";
const report = {
  checkedAt: new Date().toISOString(),
  checks: [],
  status: "running",
};
try {
  for (const [name, engine] of Object.entries({ chromium, webkit })) {
    const browser = await engine.launch({ headless: true });
    try {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
        hasTouch: true,
      });
      await page.addInitScript(() => {
        window.__storyMedia = [];
        window.__storyPaints = 0;
        const paint = CanvasRenderingContext2D.prototype.fillRect;
        CanvasRenderingContext2D.prototype.fillRect = function (...args) {
          if (this.canvas.matches("[data-story-canvas]"))
            window.__storyPaints++;
          return paint.apply(this, args);
        };
        const create = document.createElement.bind(document);
        document.createElement = (name, ...args) => {
          const el = create(name, ...args);
          if (["audio", "video"].includes(name.toLowerCase()))
            window.__storyMedia.push(el);
          return el;
        };
      });
      await page.goto(base + "/#record/" + id);
      await page.locator("[data-story-export]").click({ timeout: 45000 });
      await page.waitForFunction(
        () => document.querySelector("[data-story-render]")?.disabled === false,
        null,
        { timeout: 60000 },
      );
      for (const width of [1440, 390])
        for (const theme of ["light", "dark"]) {
          await page.setViewportSize({ width, height: 1000 });
          await page.evaluate(
            (theme) => (document.documentElement.dataset.theme = theme),
            theme,
          );
          assert.equal(
            await page.locator(".story-exact").evaluate((el) => el.open),
            false,
          );
          const track = page.locator("[data-story-timeline]");
          const selection = page.locator("[data-story-selection]");
          const box = await track.boundingBox();
          await page.touchscreen.tap(box.x + box.width * 0.5, box.y + 25);
          const before = Number(await selection.getAttribute("aria-valuenow"));
          const sb = await selection.boundingBox();
          const target = await selection.evaluate((el) =>
            parseFloat(getComputedStyle(el, "::after").width),
          );
          assert.ok(target >= 44);
          // Tap within expanded selection hit area, outside its narrow visual window; selection must not jump.
          await page.touchscreen.tap(sb.x + sb.width / 2 + 18, sb.y + 25);
          assert.equal(
            Number(await selection.getAttribute("aria-valuenow")),
            before,
          );
          await page.mouse.move(sb.x + sb.width / 2 + 18, sb.y + 25);
          await page.mouse.down();
          await page.mouse.move(sb.x + sb.width / 2 + 38, sb.y + 25, {
            steps: 4,
          });
          await page.mouse.up();
          assert.ok(
            Number(await selection.getAttribute("aria-valuenow")) > before,
          );
          assert.equal(
            await page.evaluate(() => document.body.scrollWidth > innerWidth),
            false,
          );
          await page.waitForTimeout(250);
          const screenshot = await page.screenshot({
            path: `captures/story-timeline-${name}-${width}-${theme}.png`,
          });
          const canvasRect = await page
            .locator("[data-story-canvas]")
            .boundingBox();
          const png = PNG.sync.read(screenshot);
          const x = Math.round(canvasRect.x + (canvasRect.width * 80) / 1080);
          const y = Math.round(canvasRect.y + (canvasRect.height * 500) / 1920);
          const pixel = [
            ...png.data.subarray(
              (y * png.width + x) * 4,
              (y * png.width + x) * 4 + 4,
            ),
          ];
          assert.ok(
            pixel[0] > 120 && pixel[2] > 80 && pixel[1] < 150,
            `Actual screenshot artwork border missing: ${pixel}`,
          );
          report.checks.push({
            engine: name,
            width,
            theme,
            hitTarget: target,
            expandedTouchTargetPassed: true,
            pointerDragPassed: true,
            exactEntryCollapsed: true,
            screenshotArtworkPixel: pixel,
          });
        }
      const paintCount = await page.evaluate(() => window.__storyPaints);
      await page.waitForTimeout(200);
      assert.equal(
        await page.evaluate(() => window.__storyPaints),
        paintCount,
        "No continuous preview redraw loop",
      );
      for (let attempt = 0; attempt < 3; attempt++) {
        await page.locator("[data-story-preview]").click();
        const box = await page.locator("[data-story-timeline]").boundingBox();
        await page.mouse.click(
          box.x + box.width * (0.2 + attempt * 0.2),
          box.y + 25,
        );
        // Dragging an already-playing selection intentionally auditions the new selection.
        // A keyboard adjustment explicitly pauses it and must invalidate any late play/seek.
        await page.locator("[data-story-selection]").focus();
        await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(350);
        assert.equal(
          await page.evaluate(
            () => window.__storyMedia.filter((m) => !m.paused).length,
          ),
          0,
        );
      }
      report.checks.push({ engine: name, rapidPlaySelectPausePassed: true });
      await page.locator("[data-story-close]").click();
      const closedPaints = await page.evaluate(() => window.__storyPaints);
      await page.evaluate(
        () => (document.documentElement.dataset.theme = "light"),
      );
      await page.setViewportSize({ width: 800, height: 1000 });
      await page.waitForTimeout(100);
      assert.equal(
        await page.evaluate(() => window.__storyPaints),
        closedPaints,
        "Closed preview observers released",
      );
      report.checks.push({
        engine: name,
        previewPaintOnlyOnChanges: true,
        closeReleasesObservers: true,
      });
      if (name === "chromium") {
        await page.goto(base + "/#recovery");
        await page
          .getByText(/1,194|1194/)
          .first()
          .waitFor({ timeout: 45000 });
        for (const width of [1440, 390])
          for (const theme of ["light", "dark"]) {
            await page.setViewportSize({ width, height: 1000 });
            await page.evaluate(
              (theme) => (document.documentElement.dataset.theme = theme),
              theme,
            );
            await page
              .getByText(/Cross-source reconciliation:/)
              .scrollIntoViewIfNeeded();
            await page.screenshot({
              path: `captures/sound-reconciliation-${width}-${theme}.png`,
              fullPage: false,
            });
            assert.equal(
              await page.evaluate(() => document.body.scrollWidth > innerWidth),
              false,
            );
          }
        report.ledgerViewsPassed = 4;
      }
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
    "data/story-timeline-layout-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(report);
}
