import { chromium, webkit } from "playwright";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
const base = process.env.BASE_URL || "http://127.0.0.1:4191";
const engine = process.env.BROWSER_ENGINE || "chromium";
const kind = process.env.BUFFER_PAIR || "audio";
const records = JSON.parse(
  readFileSync("data/supercollector/recovered-media.json"),
).records;
const ids =
  kind === "video"
    ? [
        "spinamp-073e25367a01a4e53532",
        "pete-zora-1-10d32bf55f5cbe66b068f2109ecf7475f0631d53-1",
      ]
    : ["OFF THE LEASH", "ROUND N ROUND"].map(
        (t) => records.find((r) => r.title === t).id,
      );
const browser = await { chromium, webkit }[engine].launch({ headless: true });
const page = await browser.newPage();
const report = {
  checkedAt: new Date().toISOString(),
  deploymentId: process.env.RELEASE_DEPLOYMENT_ID || null,
  sourceCommit: process.env.RELEASE_SOURCE_COMMIT || null,
  base,
  engine,
  kind,
  ids,
  scope:
    "Real app/media. Native ended event after seeking current track near its end; not a full-track audition or sample-accurate gapless claim.",
  status: "running",
  requests: [],
  errors: [],
};
page.on("pageerror", (e) => report.errors.push(e.message));
page.on("request", (r) => {
  if (r.resourceType() === "media")
    report.requests.push({
      url: r.url(),
      range: r.headers().range || null,
      at: Date.now(),
    });
});
await page.addInitScript(
  ({ ids }) => {
    localStorage.setItem("mn-archive-shuffle", "false");
    localStorage.setItem(
      "mn-archive-playlists-v1",
      JSON.stringify([
        { id: "continuity-qa", name: "Continuity QA", recordIds: ids },
      ]),
    );
    window.__media = [];
    function track(m) {
      if (window.__media.includes(m)) return;
      m.__trace = [];
      window.__media.push(m);
      for (const name of [
        "loadstart",
        "emptied",
        "play",
        "playing",
        "pause",
        "ended",
        "waiting",
        "suspend",
        "error",
      ])
        m.addEventListener(name, () =>
          m.__trace.push({
            name,
            at: performance.now(),
            time: m.currentTime,
            paused: m.paused,
            src: m.currentSrc,
          }),
        );
    }
    for (const key of ["load", "play", "pause"]) {
      const original = HTMLMediaElement.prototype[key];
      HTMLMediaElement.prototype[key] = function (...args) {
        track(this);
        this.__trace.push({
          name: "call:" + key,
          at: performance.now(),
          src: this.getAttribute("src"),
        });
        return original.apply(this, args);
      };
    }
    const desc = Object.getOwnPropertyDescriptor(
      HTMLMediaElement.prototype,
      "src",
    );
    Object.defineProperty(HTMLMediaElement.prototype, "src", {
      ...desc,
      set(value) {
        track(this);
        this.__trace.push({ name: "set:src", at: performance.now(), value });
        return desc.set.call(this, value);
      },
    });
  },
  { ids },
);
const state = () =>
  page.evaluate(() =>
    window.__media.map((m) => ({
      active: m === document.querySelector("#audio"),
      src: m.getAttribute("src"),
      currentSrc: m.currentSrc,
      paused: m.paused,
      time: m.currentTime,
      duration: m.duration,
      readyState: m.readyState,
      videoWidth: m.videoWidth,
      ranges: Array.from({ length: m.buffered.length }, (_, i) => [
        m.buffered.start(i),
        m.buffered.end(i),
      ]),
      events: m.__trace,
    })),
  );
try {
  await page.goto(base + "/#playlist/continuity-qa", {
    waitUntil: "domcontentloaded",
  });
  await page
    .getByRole("heading", { name: "Continuity QA", exact: true })
    .waitFor();
  await page.locator("[data-play-personal]").click();
  await page.waitForFunction(
    () => document.querySelector("#audio").currentTime > 0.5,
    null,
    { timeout: 40000 },
  );
  await page.waitForFunction(
    () =>
      window.__media.some(
        (m) =>
          m !== document.querySelector("#audio") &&
          m.buffered.length &&
          m.buffered.start(0) < 0.1 &&
          m.buffered.end(0) > 0.5,
      ),
    null,
    { timeout: 35000 },
  );
  await page.evaluate(() => {
    window.__old = document.querySelector("#audio");
    window.__warm = window.__media.find(
      (m) =>
        m !== __old &&
        m.buffered.length &&
        m.buffered.start(0) < 0.1 &&
        m.buffered.end(0) > 0.5,
    );
  });
  await page.waitForTimeout(1000);
  report.before = await state();
  const beforeActive = report.before.find((m) => m.active),
    beforeWarm = report.before.find((m) => m.src && !m.active);
  assert.ok(beforeWarm.paused);
  assert.equal(beforeWarm.time, 0);
  assert.equal(
    beforeWarm.events.filter((e) => e.name === "call:play").length,
    0,
    "Standby must never play before adoption",
  );
  if (kind === "video")
    assert.ok(beforeWarm.videoWidth > 0, "Video standby decoded metadata");
  await page.locator("#toggle").click();
  await page.waitForTimeout(400);
  report.suspended = await state();
  assert.equal(
    await page.evaluate(() => __warm.getAttribute("src")),
    beforeWarm.src,
    "Pause must retain standby source",
  );
  assert.equal(
    await page.evaluate(
      () => __warm.__trace.filter((e) => e.name === "emptied").length,
    ),
    beforeWarm.events.filter((e) => e.name === "emptied").length,
    "Pause must retain native buffer",
  );
  await page.locator("#toggle").click();
  await page.waitForFunction(
    (t) => document.querySelector("#audio").currentTime > t + 0.3,
    beforeActive.time,
    { timeout: 20000 },
  );
  // Seek the current source near its real end; allow browser to emit ended itself.
  await page.evaluate(() => {
    __old.currentTime = Math.max(0, __old.duration - 0.35);
    window.__handoffRequested = performance.now();
  });
  await page.waitForFunction(
    () =>
      document.querySelector("#audio") === window.__warm &&
      window.__warm.currentTime > 0.5,
    null,
    { timeout: 40000 },
  );
  report.after = await state();
  report.handoff = await page.evaluate(() => ({
    timeOrigin: performance.timeOrigin,
    sameElement: document.querySelector("#audio") === __warm,
    oldReleased: !__old.getAttribute("src"),
    activeCount: document.querySelectorAll("#audio").length,
    endedAt: __old.__trace.findLast((e) => e.name === "ended")?.at,
    playingAt: __warm.__trace.find((e) => e.name === "playing")?.at,
    src: __warm.getAttribute("src"),
    events: __warm.__trace,
  }));
  assert.ok(report.handoff.sameElement);
  assert.ok(report.handoff.oldReleased);
  assert.equal(report.handoff.activeCount, 1);
  assert.ok(report.handoff.endedAt, "Browser must emit actual ended");
  for (const event of ["set:src", "call:load", "loadstart", "emptied"])
    assert.equal(
      report.handoff.events.filter((e) => e.name === event).length,
      beforeWarm.events.filter((e) => e.name === event).length,
      "Adoption must not restart " + event,
    );
  report.handoff.endedToPlayingMs =
    report.handoff.playingAt - report.handoff.endedAt;
  report.redundantZeroRangeAfterAdoption = report.requests.filter(
    (r) =>
      r.url === report.handoff.src &&
      /^bytes=0-/.test(r.range || "") &&
      r.at > report.handoff.timeOrigin + report.handoff.endedAt,
  );
  assert.equal(
    report.redundantZeroRangeAfterAdoption.length,
    0,
    "Adoption must not restart a zero-range download",
  );
  assert.deepEqual(report.errors, []);
  await page.locator("#toggle").click();
  report.status = "passed";
  console.log(
    JSON.stringify({
      engine,
      kind,
      status: report.status,
      buffered: beforeWarm.ranges,
      handoffMs: report.handoff.endedToPlayingMs,
      sameElement: true,
    }),
  );
} catch (e) {
  report.status = "failed";
  report.error = e.message;
  report.finalState = await state().catch(() => []);
  console.log(
    JSON.stringify({ engine, kind, status: "failed", error: e.message }),
  );
  process.exitCode = 1;
} finally {
  await browser.close();
  writeFileSync(
    `data/${process.env.RECEIPT_PREFIX || "buffer-continuity"}-${engine}-${kind}.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
}
