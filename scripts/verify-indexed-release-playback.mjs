import { chromium, webkit } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.VERIFY_BASE_URL || "http://127.0.0.1:4303";
const report = {
  checkedAt: new Date().toISOString(),
  base,
  scope:
    "Bounded real app playback of3 candidate recordings, not full-track audition or all-catalog availability.",
  results: [],
};
for (const [engine, id] of [
  ["chromium", "spinamp-4130ab5f9ba118dd8bca"],
  ["webkit", "spinamp-66e7d6a196ca36f3f447"],
  ["chromium", "spinamp-3d0fac554ccb97331ded"],
]) {
  const browser = await { chromium, webkit }[engine].launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/#record/" + id, { waitUntil: "domcontentloaded" });
    await page.locator(".record-head [data-play]").waitFor({ timeout: 60000 });
    await page.locator(".record-head [data-play]").click();
    await page.waitForFunction(
      () => {
        const e = document.querySelector("#audio");
        return e && !e.paused && e.currentTime > 1 && e.readyState >= 2;
      },
      {},
      { timeout: 45000 },
    );
    const media = await page.locator("#audio").evaluate((e) => ({
      currentTime: e.currentTime,
      duration: e.duration,
      readyState: e.readyState,
      src: e.currentSrc,
      width: e.videoWidth,
      height: e.videoHeight,
      decodedBytes: e.webkitAudioDecodedByteCount ?? null,
    }));
    assert.ok(media.duration > 0);
    if (id === "spinamp-3d0fac554ccb97331ded") assert.ok(media.width > 0);
    await page.screenshot({
      path: `captures/indexed-release-playing-${engine}-${id}.png`,
    });
    await page.locator("#audio").evaluate((e) => e.pause());
    report.results.push({
      engine,
      id,
      status: "played",
      media,
      pageErrors: errors,
    });
  } catch (e) {
    report.results.push({
      engine,
      id,
      status: "unavailable",
      error: e.message,
    });
  } finally {
    await browser.close();
  }
}
report.status = report.results.every(
  (r) => r.status === "played" && !r.pageErrors.length,
)
  ? "passed"
  : "partial";
writeFileSync(
  "data/indexed-release-playback-verification.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
