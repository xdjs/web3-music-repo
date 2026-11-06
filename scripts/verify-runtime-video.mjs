import { webkit } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.ARCHIVE_QA_URL || "http://127.0.0.1:4191";
const cases = [
  ["Helmet City", "spinamp-4bff201350e878d8dcfc"],
  ["Base Day Two", "spinamp-073e25367a01a4e53532"],
];
const browser = await webkit.launch({ headless: true });
const report = {
  checkedAt: new Date().toISOString(),
  base,
  engine: "Touch WebKit",
  records: [],
};
try {
  for (const [name, id] of cases) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const result = { name, id, responses: [], errors: [] };
    page.on("pageerror", (error) => result.errors.push(error.message));
    page.on("response", (response) => {
      if (
        /ipfs|arweave|cloudfront/.test(response.url()) &&
        result.responses.length < 20
      )
        result.responses.push({
          url: response.url(),
          status: response.status(),
        });
    });
    try {
      await page.goto(base + "/#record/" + id);
      await page.locator(`[data-play="${id}"]`).tap();
      await page.waitForFunction(
        () => {
          const a = document.querySelector("#audio");
          return a.currentTime > 0.3 && a.videoWidth > 0 && a.videoHeight > 0;
        },
        null,
        { timeout: 55000 },
      );
      result.playing = await page.locator("#audio").evaluate((a) => ({
        source: a.currentSrc,
        time: a.currentTime,
        paused: a.paused,
        width: a.videoWidth,
        height: a.videoHeight,
        presented: a.classList.contains("video-visible"),
        css: getComputedStyle(a).display,
        duration: a.duration,
        count: document.querySelectorAll("audio,video").length,
        dialogOpen: a.closest("dialog").open,
        artVisible:
          getComputedStyle(document.querySelector('[data-now="art"]'))
            .display !== "none",
      }));
      assert.equal(result.playing.dialogOpen, true);
      assert.equal(result.playing.paused, false);
      assert.equal(result.playing.presented, true);
      assert.equal(result.playing.artVisible, false);
      assert.equal(result.playing.count, 1);
      await page.screenshot({ path: `captures/runtime-video-${id}.png` });
      await page
        .getByRole("button", { name: "Back to discovery", exact: true })
        .tap();
      await page.waitForTimeout(300);
      result.afterBack = await page.locator("#audio").evaluate((a) => ({
        time: a.currentTime,
        paused: a.paused,
        source: a.currentSrc,
      }));
      assert.equal(result.afterBack.paused, false);
      assert.ok(result.afterBack.time > result.playing.time);
      assert.equal(result.afterBack.source, result.playing.source);
      assert.deepEqual(result.errors, []);
      result.passed = true;
    } catch (error) {
      result.passed = false;
      result.error = error.message;
      result.state = await page
        .locator("#audio")
        .evaluate((a) => ({
          source: a.currentSrc,
          time: a.currentTime,
          paused: a.paused,
          readyState: a.readyState,
          width: a.videoWidth,
          height: a.videoHeight,
          error: a.error?.message,
          status: document.querySelector("#player-source").textContent,
        }))
        .catch(() => null);
    } finally {
      report.records.push(result);
      await page.close();
    }
  }
  report.passed = report.records.every((record) => record.passed);
} finally {
  writeFileSync(
    "data/runtime-video-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
assert.equal(report.passed, true);
