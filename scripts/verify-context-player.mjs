import { chromium, webkit } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
process.chdir(fileURLToPath(new URL("../", import.meta.url)));
const base = process.env.VERIFY_BASE_URL || "http://127.0.0.1:4191",
  id = "recovered-sound-10-1bfc0624b52e870cc00d4e39995c75c7da8763d3",
  r = {
    checkedAt: new Date().toISOString(),
    base,
    checks: [],
    views: [],
    errors: [],
  };
try {
  for (const [engine, touch] of [
    [chromium, false],
    [webkit, true],
  ]) {
    const b = await engine.launch({ headless: true });
    try {
      const p = await b.newPage({
        viewport: { width: touch ? 390 : 1440, height: touch ? 844 : 1000 },
        hasTouch: touch,
        isMobile: touch,
      });
      p.on("pageerror", (e) => r.errors.push(e.message));
      p.setDefaultTimeout(20000);
      await p.goto(base + "/#record/" + id);
      const play = p.locator(`[data-play="${id}"]`);
      if (touch) await play.tap();
      else await play.click();
      await p.waitForFunction(
        () => document.querySelector("#audio").currentTime > 0.4,
        null,
        { timeout: 40000 },
      );
      const dlg = p.locator("#now-playing-dialog");
      assert.equal(await dlg.evaluate((n) => n.open), false);
      assert.equal(await p.evaluate(() => location.hash), "#record/" + id);
      const before = await p
        .locator("#audio")
        .evaluate((a) => ({ t: a.currentTime, src: a.currentSrc }));
      const artist = await p.locator("#player-artist").getAttribute("href");
      await p.locator("#player-artist").click();
      await p.waitForFunction((hash) => location.hash === hash, artist);
      await p.locator("#player-title").click();
      await p.waitForFunction(
        (hash) => location.hash === hash,
        "#record/" + id,
      );
      assert.equal(await dlg.evaluate((n) => n.open), false);
      const expand = p.locator(
        touch ? "#open-now-playing" : "#expand-now-playing",
      );
      if (touch) await expand.tap();
      else await expand.click();
      assert.equal(await dlg.evaluate((n) => n.open), true);
      assert.equal(
        await dlg.locator('[data-now="artist"]').getAttribute("href"),
        artist,
      );
      await dlg.locator('[data-now="artist"]').click();
      await p.waitForFunction((hash) => location.hash === hash, artist);
      assert.equal(await dlg.evaluate((n) => n.open), false);
      await expand.click();
      await dlg.locator('[data-now="title"]').click();
      await p.waitForFunction(
        (hash) => location.hash === hash,
        "#record/" + id,
      );
      await expand.click();
      for (const [w, h] of touch
        ? [
            [320, 568],
            [320, 844],
            [390, 667],
            [390, 844],
            [430, 740],
            [430, 932],
          ]
        : [[1440, 1000]])
        for (const theme of ["light", "dark"]) {
          await p.setViewportSize({ width: w, height: h });
          await p.evaluate(
            (t) => (document.documentElement.dataset.theme = t),
            theme,
          );
          await p.waitForTimeout(120);
          await p.waitForFunction(
            () => {
              const i = document.querySelector('[data-now="art"]');
              return i.complete && i.naturalWidth > 0;
            },
            null,
            { timeout: 20000 },
          );
          const dims = await dlg.evaluate((n) => {
            const t = n
                .querySelector(".now-playing-transport")
                .getBoundingClientRect(),
              a = n.querySelector(".now-playing-media").getBoundingClientRect();
            return {
              overflowX: n.scrollWidth > n.clientWidth,
              overflowY: n.scrollHeight > n.clientHeight + 1,
              bottom: innerHeight - t.bottom,
              artWidth: a.width,
              artHeight: a.height,
            };
          });
          assert.equal(dims.overflowX, false);
          assert.equal(dims.overflowY, false);
          assert.ok(Math.abs(dims.artWidth - dims.artHeight) < 2);
          if (touch) assert.ok(dims.bottom >= 24 && dims.bottom <= 60);
          await p.screenshot({
            path: `captures/context-player-${w}-${h}-${theme}.png`,
          });
          r.views.push({ w, h, theme, ...dims });
        }
      await dlg
        .getByRole("button", { name: "Back to discovery", exact: true })
        .click();
      const after = await p.locator("#audio").evaluate((a) => ({
        t: a.currentTime,
        src: a.currentSrc,
        paused: a.paused,
      }));
      assert.equal(after.src, before.src);
      assert.ok(after.t > before.t);
      assert.equal(after.paused, false);
      r.checks.push(
        `${touch ? "Touch WebKit" : "Desktop Chromium"}: Play stayed in context; compact and expanded song/artist links correct; explicit expand/back retained real playback`,
      );
    } finally {
      await b.close();
    }
  }
  assert.deepEqual(r.errors, []);
  r.passed = true;
} catch (e) {
  r.passed = false;
  r.error = e.stack;
  throw e;
} finally {
  writeFileSync(
    "data/context-player-verification.json",
    JSON.stringify(r, null, 2) + "\n",
  );
  console.log(JSON.stringify(r, null, 2));
}
