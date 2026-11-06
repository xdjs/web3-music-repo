import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
process.chdir(fileURLToPath(new URL("../", import.meta.url)));
const base = process.env.VERIFY_BASE_URL || "http://127.0.0.1:4191",
  id = "spinamp-c4fbf6953ce75fd2a410",
  r = { checkedAt: new Date().toISOString(), base, id },
  b = await chromium.launch(),
  p = await b.newPage();
try {
  await p.goto(base + "/#record/" + id);
  await p.locator(`[data-play="${id}"]`).click();
  await p.locator("#show-queue").click();
  r.queue = await p
    .locator(".queue-item [data-play-record]")
    .evaluateAll((ns) => ns.map((n) => n.dataset.playRecord));
  r.currentIndex = await p
    .locator(".queue-item.current [data-queue-play]")
    .getAttribute("data-queue-play");
  assert.equal(r.queue[0], id);
  assert.equal(r.currentIndex, "0");
  assert.ok(r.queue.length > 1);
  await p.locator("#queue-dialog [data-close]").click();
  await p.waitForFunction(
    () => {
      const a = document.querySelector("#audio");
      return a.currentTime > 0.3 && Number.isFinite(a.duration);
    },
    null,
    { timeout: 40000 },
  );
  r.before = await p.locator("#audio").evaluate((a) => ({
    t: a.currentTime,
    duration: a.duration,
    source: a.currentSrc,
  }));
  await p.evaluate(() => {
    window.observedEnded = 0;
    document
      .querySelector("#audio")
      .addEventListener("ended", () => window.observedEnded++);
    document.querySelector("#audio").currentTime =
      document.querySelector("#audio").duration - 0.25;
  });
  await p.waitForFunction(
    (id) =>
      document.querySelector("#player-title").getAttribute("href") ===
      "#record/" + id,
    r.queue[1],
    { timeout: 40000 },
  );
  r.after = await p.locator("#audio").evaluate((a) => ({
    t: a.currentTime,
    duration: a.duration,
    source: a.currentSrc,
    endedEvents: window.observedEnded,
    paused: a.paused,
    title: document.querySelector("#player-title").textContent,
    link: document.querySelector("#player-title").getAttribute("href"),
  }));
  assert.equal(r.after.endedEvents, 1);
  await p.waitForFunction(
    () => {
      const a = document.querySelector("#audio");
      return a.currentTime > 0.3 && !a.paused;
    },
    null,
    { timeout: 35000 },
  );
  r.nextPlayback = await p.locator("#audio").evaluate((a) => ({
    time: a.currentTime,
    source: a.currentSrc,
    paused: a.paused,
    title: document.querySelector("#player-title").textContent,
  }));
  r.passed = true;
} catch (e) {
  r.passed = false;
  r.error = e.message;
  r.state = await p
    .locator("#audio")
    .evaluate((a) => ({
      t: a.currentTime,
      duration: a.duration,
      src: a.currentSrc,
      ready: a.readyState,
      ended: a.ended,
      paused: a.paused,
    }))
    .catch(() => null);
} finally {
  writeFileSync(
    "data/ended-context-verification.json",
    JSON.stringify(r, null, 2) + "\n",
  );
  console.log(JSON.stringify(r, null, 2));
  await b.close();
}
assert.equal(r.passed, true);
