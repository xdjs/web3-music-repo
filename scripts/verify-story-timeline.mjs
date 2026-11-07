import { chromium, webkit } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const base = process.env.BASE_URL || "http://127.0.0.1:4191";
const id = "pete-zora-1-10d32bf55f5cbe66b068f2109ecf7475f0631d53-1";
mkdirSync("work/story-timeline", { recursive: true });
const report = {
  checkedAt: new Date().toISOString(),
  scope:
    "Actual local app, original Planet X cover and artist-approved corrected playback source; explicit Story export only, no listening transcodes or social upload.",
  checks: [],
  status: "running",
};
try {
  for (const [engineName, engine] of Object.entries({ chromium, webkit })) {
    const browser = await engine.launch({ headless: true });
    try {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
        acceptDownloads: true,
        hasTouch: true,
      });
      await page.addInitScript(() => {
        window.__storyMedia = [];
        const create = document.createElement.bind(document);
        document.createElement = function (name, ...args) {
          const element = create(name, ...args);
          if (["audio", "video"].includes(name.toLowerCase()))
            window.__storyMedia.push(element);
          return element;
        };
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base + "/#record/" + id, {
        waitUntil: "domcontentloaded",
      });
      await page.locator(".record-head .cover img").waitFor({ timeout: 45000 });
      await page.locator("[data-story-export]").click();
      await page.waitForFunction(
        () =>
          !document.querySelector("[data-story-render]").disabled ||
          document
            .querySelector("[data-story-status]")
            .classList.contains("notice"),
        null,
        { timeout: 60000 },
      );
      assert.equal(
        await page.locator("[data-story-render]").isEnabled(),
        true,
        await page.locator("[data-story-status]").innerText(),
      );
      const track = page.locator("[data-story-timeline]");
      const selection = page.locator("[data-story-selection]");
      const bounds = await track.boundingBox();
      await page.mouse.click(
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2,
      );
      const initial = Number(await selection.getAttribute("aria-valuenow"));
      assert.ok(initial > 100 && initial < 125);
      const selectedBox = await selection.boundingBox();
      await page.mouse.move(
        selectedBox.x + selectedBox.width / 2,
        selectedBox.y + 20,
      );
      await page.mouse.down();
      await page.mouse.move(
        selectedBox.x + selectedBox.width / 2 + 20,
        selectedBox.y + 20,
        { steps: 5 },
      );
      await page.mouse.up();
      assert.ok(
        Number(await selection.getAttribute("aria-valuenow")) > initial,
      );
      await selection.focus();
      await page.keyboard.press("Home");
      await page.keyboard.press("ArrowRight");
      assert.equal(Number(await selection.getAttribute("aria-valuenow")), 1);
      await page.locator("[data-story-preview]").click();
      await page.waitForTimeout(900);
      assert.match(
        await page.locator("[data-story-preview]").innerText(),
        /Pause/,
      );
      assert.ok(
        Number(await page.locator("[data-story-seek]").inputValue()) > 0.1,
      );
      await page.locator("[data-story-preview]").click();
      assert.equal(
        await page.evaluate(
          () => window.__storyMedia.filter((m) => !m.paused).length,
        ),
        0,
      );
      await page.locator("[data-story-seek]").evaluate((el) => {
        el.value = "7";
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await page.waitForTimeout(500);
      assert.ok(
        Number(await page.locator("[data-story-seek]").inputValue()) >= 7,
      );
      assert.equal(
        await page.evaluate(
          () => window.__storyMedia.filter((m) => !m.paused).length,
        ),
        1,
      );
      await page.locator("[data-story-preview]").click();
      await page.locator(".story-exact summary").click();
      await page.locator("[data-story-start]").fill("100");
      await page.locator("[data-story-start]").dispatchEvent("change");
      assert.match(
        await page.locator("[data-story-source]").innerText(),
        /Artist-supplied/,
      );
      await page.locator(".story-exact summary").click();
      for (const [width, theme] of [
        [1440, "light"],
        [1440, "dark"],
        [390, "light"],
        [390, "dark"],
      ]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(
          (theme) => (document.documentElement.dataset.theme = theme),
          theme,
        );
        if (width === 390) {
          const box = await track.boundingBox();
          await page.touchscreen.tap(
            box.x + box.width * 0.45,
            box.y + box.height / 2,
          );
          assert.ok(Number(await selection.getAttribute("aria-valuenow")) > 80);
        }
        await page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
        );
        await page.screenshot({
          path: `work/story-timeline/${engineName}-${width}-${theme}.png`,
        });
        assert.equal(
          await page.evaluate(() => document.body.scrollWidth > innerWidth),
          false,
        );
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.locator(".story-exact summary").click();
      await page.locator("[data-story-start]").fill("100");
      await page.locator("[data-story-start]").dispatchEvent("change");
      await page.locator("[data-story-preview]").click();
      await page.waitForTimeout(800);
      await page.locator("[data-story-render]").click();
      await page.waitForFunction(
        () =>
          document
            .querySelector("[data-story-status]")
            .textContent.startsWith("MP4 ready") ||
          document
            .querySelector("[data-story-status]")
            .classList.contains("notice"),
        null,
        { timeout: 35000 },
      );
      assert.match(
        await page.locator("[data-story-status]").innerText(),
        /^MP4 ready/,
      );
      const download = await Promise.all([
        page.waitForEvent("download"),
        page.locator("[data-story-download]").click(),
      ]).then((x) => x[0]);
      const file = `work/story-timeline/${engineName}-planet-x.mp4`;
      await download.saveAs(file);
      const probe = JSON.parse(
        execFileSync(
          "ffprobe",
          ["-v", "error", "-show_streams", "-show_format", "-of", "json", file],
          { encoding: "utf8" },
        ),
      );
      const video = probe.streams.find((s) => s.codec_type === "video"),
        audio = probe.streams.find((s) => s.codec_type === "audio");
      assert.equal(video.codec_name, "h264");
      assert.equal(audio.codec_name, "aac");
      assert.equal(video.width, 1080);
      assert.equal(video.height, 1920);
      assert.ok(
        Number(probe.format.duration) >= 14.8 &&
          Number(probe.format.duration) < 16,
      );
      await page.locator("[data-story-result]").evaluate((v) => v.play());
      await page.waitForTimeout(800);
      assert.ok(
        (await page
          .locator("[data-story-result]")
          .evaluate((v) => v.currentTime)) > 0,
      );
      execFileSync(
        "ffmpeg",
        [
          "-y",
          "-i",
          file,
          "-frames:v",
          "1",
          `work/story-timeline/${engineName}-frame.png`,
        ],
        { stdio: "ignore" },
      );
      // Capture encoded metadata separately; source-note download must retain exact correction attribution.
      const manifest = await page
        .locator("[data-story-manifest]")
        .getAttribute("href");
      assert.match(decodeURIComponent(manifest), /artist-supplied-correction/);
      await page.locator("[data-story-render]").click();
      await page.waitForTimeout(1200);
      await page.locator("[data-story-cancel]").click();
      await page.waitForFunction(() =>
        document
          .querySelector("[data-story-status]")
          .textContent.includes("cancelled"),
      );
      assert.equal(await page.locator("[data-story-render]").isEnabled(), true);
      await page.locator("[data-story-close]").click();
      assert.equal(
        await page.locator("#story-export-dialog").evaluate((d) => d.open),
        false,
      );
      assert.equal(
        await page.evaluate(() =>
          window.__storyMedia.some((m) => !m.paused && !m.ended),
        ),
        false,
      );
      if (engineName === "chromium") {
        await page.route(
          "**/media/planet-x-artist-corrected-720.mp4",
          (route) =>
            route.fulfill({
              status: 200,
              headers: { "content-length": "40000000" },
              body: "",
            }),
        );
        await page.locator("[data-story-export]").click();
        await page.waitForFunction(() =>
          document
            .querySelector("[data-story-status]")
            .textContent.includes("too large"),
        );
        assert.equal(
          await page.locator("[data-story-render]").isDisabled(),
          true,
        );
        assert.equal(
          await page.locator("[data-story-retry]").isVisible(),
          true,
        );
        await page.unroute("**/media/planet-x-artist-corrected-720.mp4");
        await page.route(
          "**/media/planet-x-artist-corrected-720.mp4",
          (route) => route.abort("accessdenied"),
        );
        await page.locator("[data-story-retry]").click();
        await page.waitForFunction(() =>
          document
            .querySelector("[data-story-status]")
            .textContent.includes("blocks browser export"),
        );
        await page.locator("[data-story-close]").click();
        report.failureChecks = {
          oversizeVisible: true,
          corsFailureVisible: true,
          retryAvailable: true,
        };
      }
      report.checks.push({
        engine: engineName,
        passed: true,
        file,
        video: {
          codec: video.codec_name,
          width: video.width,
          height: video.height,
        },
        audio: { codec: audio.codec_name, channels: audio.channels },
        duration: Number(probe.format.duration),
        bytes: Number(probe.format.size),
        previewAdvances: true,
        cancelPassed: true,
        errors,
      });
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  }
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack;
  throw error;
} finally {
  writeFileSync(
    "data/story-timeline-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
