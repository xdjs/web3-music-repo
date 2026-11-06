import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const url = "https://arweave.net/a4b8Spd5rcouKzttmYQnToH_d6nW6Sc-dMY2bHvpTW4";
const b = await chromium.launch({ headless: true });
const p = await b.newPage();
const report = {
  checkedAt: new Date().toISOString(),
  scope:
    "Controlled15-second delay of the actual original media request, followed by live source playback. No media response was fabricated.",
  url,
};
try {
  let routed = false;
  await p.route(url, async (route) => {
    if (!routed) {
      routed = true;
      await new Promise((r) => setTimeout(r, 15000));
    }
    await route.continue();
  });
  await p.goto("http://127.0.0.1:4190/#record/record-not4me");
  await p.locator("main h1").waitFor();
  await p.locator('[data-play="record-not4me"]').first().click();
  await p.waitForTimeout(13000);
  report.afterDeadline = await p.locator("#audio").evaluate((a) => ({
    time: a.currentTime,
    paused: a.paused,
    readyState: a.readyState,
    error: a.error?.message || null,
    status: document.querySelector("#player-source").textContent,
  }));
  assert.equal(
    report.afterDeadline.paused,
    false,
    "Slow original media must remain pending rather than paused",
  );
  assert.equal(report.afterDeadline.error, null);
  assert.match(report.afterDeadline.status, /taking longer/);
  await p.waitForFunction(
    () => document.querySelector("#audio").currentTime > 1,
    null,
    { timeout: 27000 },
  );
  report.completed = await p.locator("#audio").evaluate((a) => ({
    time: a.currentTime,
    paused: a.paused,
    duration: a.duration,
    readyState: a.readyState,
    source: a.currentSrc,
    status: document.querySelector("#player-source").textContent,
  }));
  assert.equal(report.completed.paused, false);
  assert.doesNotMatch(
    report.completed.status,
    /taking longer|unavailable|Retrying/,
  );
  report.passed = true;
  console.log(JSON.stringify(report));
} finally {
  writeFileSync(
    "data/slow-playback-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  await b.close();
}
