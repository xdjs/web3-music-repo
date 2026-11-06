import { chromium, webkit } from "playwright";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
const base = process.env.BASE_URL || "http://127.0.0.1:4191";
const first = JSON.parse(
  readFileSync("data/supercollector/recovered-media.json"),
).records.find((r) => r.title === "OFF THE LEASH").id;
const next = JSON.parse(
  readFileSync("data/supercollector/recovered-media.json"),
).records.find((r) => r.title === "ROUND N ROUND").id;
const engine = process.env.BROWSER_ENGINE || "chromium";
const mode = process.env.TRANSITION_MODE || "next";
const browser = await (engine === "webkit" ? webkit : chromium).launch({
  headless: true,
});
const context = await browser.newContext();
await context.addInitScript(
  ({ first, next }) => {
    localStorage.setItem("mn-archive-shuffle", "false");
    localStorage.setItem(
      "mn-archive-playlists-v1",
      JSON.stringify([
        {
          id: "buffer-validation",
          name: "Buffer validation",
          recordIds: [first, next],
        },
      ]),
    );
    window.__nativeMedia = [];
    const create = document.createElement.bind(document);
    document.createElement = function (...args) {
      const el = create(...args);
      if (["video", "audio"].includes(String(args[0]).toLowerCase())) {
        window.__nativeMedia.push(el);
        el.__events = [];
        for (const name of ["loadstart", "emptied", "playing", "error"])
          el.addEventListener(name, () =>
            el.__events.push({ name, at: performance.now() }),
          );
      }
      return el;
    };
  },
  { first, next },
);
const page = await context.newPage();
const errors = [],
  requests = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (
    r.resourceType() === "media" ||
    /\.(mp3|m4a|wav|ogg)(\?|$)/i.test(r.url())
  )
    requests.push({
      url: r.url(),
      range: r.headers().range || null,
      at: Date.now(),
    });
});
try {
  await page.goto(base + "/#playlist/buffer-validation");
  await page
    .getByRole("heading", { name: "Buffer validation", exact: true })
    .waitFor();
  await page.locator("[data-play-personal]").click();
  await page.waitForFunction(
    () => document.querySelector("#audio").currentTime > 0.5,
    null,
    { timeout: 30000 },
  );
  await page.locator("#volume").evaluate((e) => {
    e.value = "0.35";
    e.dispatchEvent(new Event("input", { bubbles: true }));
  });
  if (mode !== "ended") await page.locator("#mute").click();
  await page.waitForFunction(
    () =>
      window.__nativeMedia.some(
        (m) =>
          m !== document.querySelector("#audio") &&
          m.buffered.length &&
          m.buffered.end(0) >= 9.9,
      ),
    null,
    { timeout: 12000 },
  );
  const before = await page.evaluate(() => {
    window.__nextWarm = window.__nativeMedia.find(
      (m) =>
        m !== document.querySelector("#audio") &&
        m.buffered.length &&
        m.buffered.end(0) >= 9.9,
    );
    window.__oldActive = document.querySelector("#audio");
    return {
      src: __nextWarm.src,
      buffered: __nextWarm.buffered.end(0),
      events: [...__nextWarm.__events],
      readyState: __nextWarm.readyState,
      preload: __nextWarm.preload,
      activeTime: __oldActive.currentTime,
      volume: __oldActive.volume,
      muted: __oldActive.muted,
    };
  });
  const requestsBefore = requests.filter((r) => r.url === before.src).length;
  assert.ok(requestsBefore > 0, "The real next-media request must be observed");
  if (mode === "blocked")
    await page.evaluate(() => {
      const original = __nextWarm.play.bind(__nextWarm);
      __nextWarm.play = () => {
        __nextWarm.play = original;
        return Promise.reject(
          new DOMException("Test browser gesture boundary", "NotAllowedError"),
        );
      };
    });
  await page.evaluate(() => {
    window.__nextRequested = performance.now();
  });
  if (mode === "ended")
    await page.locator("#audio").evaluate((a) => {
      a.currentTime = a.duration - 0.15;
    });
  else await page.locator("#next").click();
  if (mode === "blocked") {
    await page
      .getByText("Ready — press play to continue", { exact: true })
      .waitFor();
    assert.equal(await page.locator("#audio").evaluate((a) => a.paused), true);
    await page.locator("#toggle").click();
  }
  await page.waitForFunction(
    () =>
      document
        .querySelector("#player-title")
        .textContent.includes("ROUND N ROUND") &&
      document.querySelector("#audio").currentTime > 0.5,
    null,
    { timeout: 20000 },
  );
  const after = await page.evaluate(() => ({
    sameElement: document.querySelector("#audio") === window.__nextWarm,
    handoffMs:
      __nextWarm.__events.find((e) => e.name === "playing")?.at -
      window.__nextRequested,
    oldReleased: !__oldActive.getAttribute("src"),
    ids: document.querySelectorAll("#audio").length,
    events: [...__nextWarm.__events],
    volume: __nextWarm.volume,
    muted: __nextWarm.muted,
    currentTime: __nextWarm.currentTime,
    standbys: window.__nativeMedia.filter(
      (m) => m !== document.querySelector("#audio") && m.getAttribute("src"),
    ).length,
  }));
  assert.equal(after.sameElement, true);
  assert.equal(after.oldReleased, true);
  assert.equal(after.ids, 1);
  assert.equal(after.volume, before.volume);
  assert.equal(after.muted, before.muted);
  assert.equal(
    after.events.filter((e) => e.name === "loadstart").length,
    before.events.filter((e) => e.name === "loadstart").length,
  );
  assert.equal(
    after.events.filter((e) => e.name === "emptied").length,
    before.events.filter((e) => e.name === "emptied").length,
  );
  assert.equal(after.standbys, 0);
  assert.deepEqual(errors, []);
  const requestsAfter = requests.filter((r) => r.url === before.src).length;
  assert.equal(
    requestsAfter,
    requestsBefore,
    "A new request must not be needed for this already-buffered Next sample",
  );
  await page.locator("#toggle").click();
  assert.equal(await page.locator("#audio").evaluate((a) => a.paused), true);
  writeFileSync(
    `data/next-track-buffer-${engine}-${mode}-verification.json`,
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        base,
        engine,
        mode,
        status: "passed",
        scope:
          "Real app: OFF THE LEASH playing while ROUND N ROUND native buffer warms. Actual element reuse on Next, volume/mute/event continuity and request count verified. No mocked media. Not a sample-accurate gapless guarantee.",
        before,
        after,
        requestsBefore,
        requestsAfter,
        errors,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify({
      status: "passed",
      sameElement: after.sameElement,
      engine,
      mode,
      handoffMs: after.handoffMs,
      bufferedSeconds: before.buffered,
      requestsBefore,
      requestsAfter,
      volume: after.volume,
      muted: after.muted,
    }),
  );
} catch (error) {
  console.log(
    JSON.stringify({
      error: error.message,
      errors,
      requests,
      media: await page.evaluate(() =>
        window.__nativeMedia.map((m) => ({
          src: m.src,
          readyState: m.readyState,
          error: m.error?.code,
          preload: m.preload,
          buffered: m.buffered.length ? m.buffered.end(0) : 0,
          events: m.__events,
        })),
      ),
      active: await page.locator("#audio").evaluate((m) => ({
        src: m.src,
        paused: m.paused,
        currentTime: m.currentTime,
        readyState: m.readyState,
      })),
      queue: await page.locator("#queue-list").innerText(),
    }),
  );
  throw error;
} finally {
  await browser.close();
}
