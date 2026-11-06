import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.BASE_URL || "http://127.0.0.1:4191";
const id = "pete-zora-1-10d32bf55f5cbe66b068f2109ecf7475f0631d53-1";
const browser = await chromium.launch();
const report = {
  checkedAt: new Date().toISOString(),
  base,
  scope:
    "Actual app and native local artist-approved MP4 playback, with request held to verify loading. Buffering readiness/waiting and error states are explicitly injected UI fixtures, not remote-provider outage claims.",
  cases: [],
};
try {
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        isMobile: width === 390,
        hasTouch: width === 390,
      });
      const p = await context.newPage();
      const c = { width, theme, errors: [] };
      report.cases.push(c);
      p.on("pageerror", (e) => c.errors.push(e.message));
      let release;
      const gate = new Promise((r) => (release = r));
      await context.route(
        "**/media/planet-x-artist-corrected-720.mp4",
        async (route) => {
          await gate;
          await route.continue();
        },
      );
      await p.goto(`${base}/#record/${id}`);
      await p
        .locator(`.record-head [data-play="${id}"]`)
        .waitFor({ timeout: 60000 });
      await p.evaluate(
        (t) => (document.documentElement.dataset.theme = t),
        theme,
      );
      await p.locator(`.record-head [data-play="${id}"]`).click();
      await p.waitForFunction(
        () => document.querySelector("#toggle").dataset.playbackBusy === "true",
      );
      assert.match(
        await p.locator("#toggle").getAttribute("aria-label"),
        /Pause.*Loading/,
      );
      assert.equal(await p.locator("#player-source").innerText(), "Loading…");
      await p.screenshot({
        path: `captures/buffering-compact-${width}-${theme}.png`,
      });
      await p.locator("#open-now-playing").click();
      await p.waitForFunction(
        () =>
          document.querySelector('[data-now="toggle"]').dataset.playbackBusy ===
          "true",
      );
      assert.equal(
        await p.locator(".now-playing-status").innerText(),
        "Loading…",
      );
      await p.screenshot({
        path: `captures/buffering-expanded-${width}-${theme}.png`,
      });
      await p.locator('[data-now="toggle"]').click();
      assert.equal(
        await p.locator('[data-now="toggle"]').getAttribute("aria-label"),
        "Play",
      );
      assert.equal(await p.locator(".now-playing-status").innerText(), "");
      c.pendingPause = true;
      release();
      await p.waitForTimeout(500);
      await p.locator('[data-now="toggle"]').click();
      await p.waitForFunction(
        () => {
          const a = document.querySelector("#audio");
          return a.currentTime > 0.15 && !a.paused;
        },
        { timeout: 20000 },
      );
      await p.waitForFunction(
        () =>
          document.querySelector('[data-now="toggle"]').dataset.playbackBusy ===
          "false",
      );
      assert.equal(await p.locator(".now-playing-status").innerText(), "");
      c.nativePlayback = true;
      await p.evaluate(() => {
        const a = document.querySelector("#audio");
        Object.defineProperty(a, "readyState", {
          configurable: true,
          value: 2,
        });
        a.dispatchEvent(new Event("waiting"));
      });
      assert.equal(
        await p.locator(".now-playing-status").innerText(),
        "Buffering…",
      );
      assert.match(
        await p.locator('[data-now="toggle"]').getAttribute("aria-label"),
        /Pause.*Buffering/,
      );
      await p.evaluate(() => {
        const a = document.querySelector("#audio");
        delete a.readyState;
        a.dispatchEvent(new Event("playing"));
      });
      assert.equal(await p.locator(".now-playing-status").innerText(), "");
      await p.evaluate(() =>
        document.querySelector("#audio").dispatchEvent(new Event("stalled")),
      );
      assert.equal(
        await p
          .locator('[data-now="toggle"]')
          .getAttribute("data-playback-busy"),
        "false",
      );
      c.bufferingAndReadyTransitions = true;
      await p.evaluate(() => {
        const a = document.querySelector("#audio");
        document.querySelector("#player-source").textContent =
          "Media unavailable — press play to retry";
        Object.defineProperty(a, "error", {
          configurable: true,
          value: { code: 2 },
        });
        a.dispatchEvent(new Event("error"));
      });
      assert.equal(
        await p
          .locator('[data-now="toggle"]')
          .getAttribute("data-playback-busy"),
        "false",
      );
      assert.equal(
        await p.locator('[data-now="toggle"]').getAttribute("aria-label"),
        "Play",
      );
      assert.equal(
        await p.locator("#player-source").innerText(),
        "Media unavailable — press play to retry",
      );
      c.errorStopsSpinner = true;
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      assert.deepEqual(c.errors, []);
      c.passed = true;
      await context.close();
    }
  report.passed = true;
} catch (e) {
  report.error = e.stack;
  report.passed = false;
  throw e;
} finally {
  await browser.close();
  writeFileSync(
    "data/buffering-feedback-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
