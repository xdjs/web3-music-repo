import { webkit } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
process.chdir(fileURLToPath(new URL("../", import.meta.url)));
const r = {
  checkedAt: new Date().toISOString(),
  base: process.env.VERIFY_BASE_URL || "http://127.0.0.1:4191",
};
const b = await webkit.launch();
let p;
try {
  p = await b.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  await p.goto(r.base + "/#record/spinamp-073e25367a01a4e53532");
  await p.locator('[data-play="spinamp-073e25367a01a4e53532"]').tap();
  await p.waitForFunction(
    () => {
      const a = document.querySelector("#audio");
      return a.currentTime > 0.3 && a.videoWidth > 0;
    },
    null,
    { timeout: 40000 },
  );
  r.collapsed = await p.locator("#audio").evaluate((a) => ({
    time: a.currentTime,
    source: a.currentSrc,
    width: a.videoWidth,
    height: a.videoHeight,
    dialogOpen: document.querySelector("#now-playing-dialog").open,
  }));
  assert.equal(r.collapsed.dialogOpen, false);
  await p.locator("#open-now-playing").tap();
  await p.waitForTimeout(150);
  r.expanded = await p.evaluate(() => {
    const a = document.querySelector("#audio"),
      v = a.getBoundingClientRect(),
      s = document.querySelector(".now-playing-media").getBoundingClientRect();
    return {
      time: a.currentTime,
      count: document.querySelectorAll("video,audio").length,
      left: v.left,
      top: v.top,
      width: v.width,
      height: v.height,
      slot: { left: s.left, top: s.top, width: s.width, height: s.height },
      workspaceInert: document.querySelector(".workspace").inert,
      focus: document.activeElement.dataset.now,
    };
  });
  assert.equal(r.expanded.count, 1);
  assert.equal(r.expanded.workspaceInert, true);
  for (const k of ["left", "top", "width", "height"])
    assert.ok(Math.abs(r.expanded[k] - r.expanded.slot[k]) < 2);
  await p.screenshot({ path: "captures/context-player-video-webkit.png" });
  await p.locator('[data-now="back"]').focus();
  await p.keyboard.press("Shift+Tab");
  assert.equal(
    await p.evaluate(() => document.activeElement.dataset.now),
    "next",
  );
  await p.keyboard.press("Tab");
  assert.equal(
    await p.evaluate(() => document.activeElement.dataset.now),
    "back",
  );
  await p.locator('[data-now="queue"]').click();
  assert.equal(await p.locator("#queue-dialog").evaluate((n) => n.open), true);
  await p.keyboard.press("Escape");
  assert.equal(
    await p.locator("#now-playing-dialog").evaluate((n) => n.open),
    true,
  );
  await p.keyboard.press("Escape");
  assert.equal(
    await p.locator("#now-playing-dialog").evaluate((n) => n.open),
    false,
  );
  assert.equal(await p.locator(".workspace").evaluate((n) => n.inert), false);
  await p.waitForTimeout(500);
  r.closed = await p.locator("#audio").evaluate((a) => ({
    time: a.currentTime,
    source: a.currentSrc,
    paused: a.paused,
  }));
  assert.equal(r.closed.source, r.collapsed.source);
  assert.ok(r.closed.time > r.collapsed.time);
  assert.equal(r.closed.paused, false);
  await p.locator("#open-now-playing").tap();
  assert.equal(
    await p.locator("#now-playing-dialog").evaluate((n) => n.open),
    true,
  );
  r.passed = true;
} catch (e) {
  r.passed = false;
  r.error = e.stack;
  r.state = await p.locator("#audio").evaluate((a) => ({
    time: a.currentTime,
    ready: a.readyState,
    paused: a.paused,
    error: a.error?.message,
    source: a.currentSrc,
    width: a.videoWidth,
    height: a.videoHeight,
    box: JSON.stringify(a.getBoundingClientRect()),
    buffered: a.buffered.length
      ? Array.from({ length: a.buffered.length }, (_, i) => [
          a.buffered.start(i),
          a.buffered.end(i),
        ])
      : [],
  }));
  throw e;
} finally {
  writeFileSync(
    "data/context-player-video-verification.json",
    JSON.stringify(r, null, 2) + "\n",
  );
  console.log(JSON.stringify(r, null, 2));
  await b.close();
}
