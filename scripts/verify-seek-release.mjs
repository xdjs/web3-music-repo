import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
process.chdir(fileURLToPath(new URL("../", import.meta.url)));
const base = process.env.VERIFY_BASE_URL || "http://127.0.0.1:4191",
  id = "spinamp-073e25367a01a4e53532",
  r = { checkedAt: new Date().toISOString(), base, cases: [] };
const b = await chromium.launch({ headless: true });
try {
  for (const touch of [false, true]) {
    const p = await b.newPage({
      viewport: { width: touch ? 390 : 1440, height: touch ? 844 : 1000 },
      hasTouch: touch,
      isMobile: touch,
    });
    const c = { touch };
    try {
      await p.goto(base + "/#record/" + id);
      await p.locator(`[data-play="${id}"]`).click();
      await p.waitForFunction(
        () => document.querySelector("#audio").currentTime > 0.3,
        null,
        { timeout: 35000 },
      );
      assert.equal(
        await p.locator("#now-playing-dialog").evaluate((n) => n.open),
        false,
      );
      await p
        .locator(touch ? "#open-now-playing" : "#expand-now-playing")
        .click();
      await p.evaluate(() => {
        window.seekCalls = [];
        const a = document.querySelector("#audio");
        a.addEventListener("seeking", () =>
          window.seekCalls.push(a.currentTime),
        );
      });
      const s = p.locator('[data-now="seek"]'),
        box = await s.boundingBox(),
        y = box.y + box.height / 2,
        x0 = box.x + 7,
        x1 = box.x + box.width * 0.6;
      if (touch) {
        const cd = await p.context().newCDPSession(p);
        await cd.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x: x0, y }],
        });
        for (let i = 1; i <= 6; i++)
          await cd.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: x0 + ((x1 - x0) * i) / 6, y }],
          });
        await p.waitForTimeout(300);
        c.during = {
          slider: await s.inputValue(),
          calls: await p.evaluate(() => window.seekCalls),
        };
        await cd.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
      } else {
        await p.mouse.move(x0, y);
        await p.mouse.down();
        await p.mouse.move(x1, y, { steps: 8 });
        await p.waitForTimeout(300);
        c.during = {
          slider: await s.inputValue(),
          calls: await p.evaluate(() => window.seekCalls),
        };
        await p.mouse.up();
      }
      assert.equal(c.during.calls.length, 0);
      assert.ok(Number(c.during.slider) > 500);
      const expected = await p
        .locator("#audio")
        .evaluate((a, v) => (a.duration * Number(v)) / 1000, c.during.slider);
      await p.waitForFunction(
        (expected) => {
          const a = document.querySelector("#audio");
          return (
            !a.seeking &&
            a.currentTime >= expected &&
            a.currentTime < expected + 4 &&
            !a.paused
          );
        },
        expected,
        { timeout: 35000 },
      );
      c.after = await p.locator("#audio").evaluate((a) => ({
        time: a.currentTime,
        duration: a.duration,
        paused: a.paused,
        seekCalls: window.seekCalls,
        source: a.currentSrc,
      }));
      assert.equal(c.after.seekCalls.length, 1);
      // Keyboard rewind commits once and retains the requested position.
      await s.focus();
      await s.press("Home");
      await p.waitForFunction(
        () => {
          const a = document.querySelector("#audio");
          return !a.seeking && a.currentTime < 2 && !a.paused;
        },
        null,
        { timeout: 25000 },
      );
      c.rewind = await p
        .locator("#audio")
        .evaluate((a) => ({ time: a.currentTime, paused: a.paused }));
      c.passed = true;
    } catch (e) {
      c.error = e.message;
      c.passed = false;
      c.state = await p
        .locator("#audio")
        .evaluate((a) => ({
          t: a.currentTime,
          seeking: a.seeking,
          ready: a.readyState,
          paused: a.paused,
          src: a.currentSrc,
        }))
        .catch(() => null);
    } finally {
      r.cases.push(c);
      await p.close();
    }
  }
  r.passed = r.cases.every((c) => c.passed);
} finally {
  writeFileSync(
    "data/seek-release-verification.json",
    JSON.stringify(r, null, 2) + "\n",
  );
  console.log(JSON.stringify(r, null, 2));
  await b.close();
}
assert.equal(r.passed, true);
