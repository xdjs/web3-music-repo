import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const report = {
  checkedAt: new Date().toISOString(),
  scope:
    "Actual archived Mija audio, isolated native player warm then adoption; no mocked media response.",
  url: "https://d2i9ybouka0ieh.cloudfront.net/audio-transcoded/fac4de0e-0b0c-4692-be2b-d22b76c3e276/AUDIO_128K/5149079-15939-Mija_-_Groove__Jacob_Grosse_Remix__24_Bit_MASTER.m4a",
  requests: [],
};
try {
  await page.route("http://preload.test/", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: '<!doctype html><button id="play">Play</button><audio id="audio"></audio>',
    }),
  );
  await page.route("http://preload.test/module.mjs", (r) =>
    r.fulfill({
      contentType: "text/javascript",
      body: readFileSync("src/media-preload.mjs", "utf8"),
    }),
  );
  page.on("request", (r) => {
    if (r.url().includes("cloudfront.net"))
      report.requests.push({
        url: r.url(),
        range: r.headers().range || null,
        time: Date.now(),
      });
  });
  await page.goto("http://preload.test/");
  await page.evaluate(async (url) => {
    const { createMediaPreloader } = await import("/module.mjs");
    const a = document.querySelector("audio");
    a.muted = true;
    window.events = [];
    for (const ev of [
      "loadstart",
      "loadedmetadata",
      "emptied",
      "playing",
      "error",
    ])
      a.addEventListener(ev, () =>
        events.push({ type: ev, time: performance.now() }),
      );
    const original = a.load.bind(a);
    window.loads = 0;
    a.load = () => {
      window.loads++;
      original();
    };
    window.warmer = createMediaPreloader(a);
    window.started = performance.now();
    window.scheduled = warmer.schedule({ id: "mija", url, kind: "audio" });
    document.querySelector("button").onclick = async () => {
      window.reused = warmer.take("mija", url);
      if (!window.reused) a.src = url;
      await a.play();
    };
  }, report.url);
  await page.waitForFunction(() => warmer.state()?.ready === true, null, {
    timeout: 6000,
  });
  report.warm = await page.evaluate(() => ({
    state: warmer.state(),
    loads,
    events: [...events],
    readyState: document.querySelector("audio").readyState,
    ms: performance.now() - started,
  }));
  const count = report.requests.length;
  await page.click("button");
  await page.waitForFunction(
    () => document.querySelector("audio").currentTime > 0.3,
    null,
    { timeout: 15000 },
  );
  report.play = await page.evaluate(() => ({
    reused,
    loads,
    events: [...events],
    time: document.querySelector("audio").currentTime,
    readyState: document.querySelector("audio").readyState,
  }));
  report.requestsBeforePlay = count;
  assert.equal(report.play.reused, true);
  assert.equal(report.play.loads, 1);
  assert.equal(
    report.play.events.filter((e) => e.type === "loadstart").length,
    1,
  );
  assert.equal(
    report.play.events.filter((e) => e.type === "emptied").length,
    report.warm.events.filter((e) => e.type === "emptied").length,
  );
  report.passed = true;
} catch (e) {
  report.passed = false;
  report.error = e.message;
  process.exitCode = 1;
} finally {
  await browser.close();
  writeFileSync(
    "data/media-preload-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
}
