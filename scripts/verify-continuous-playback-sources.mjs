import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
const base = process.env.BASE_URL || "http://127.0.0.1:4191";
const b = await chromium.launch();
const report = {
  checkedAt: new Date().toISOString(),
  base,
  scope:
    "Actual existing playback sources, native startup plus two seconds of advancing playhead. No new transcodes or source overrides; not full-song audition.",
  records: [],
};
try {
  for (const id of [
    "record-1956ba25",
    "recovered-sound-10-145ac4d1ad5817b28997a479a980ea1d5d53e3e9",
    "recovered-sound-10-191fc84c0dd16a5f7aa333c39021227a91cc44a3",
  ]) {
    const p = await b.newPage();
    const result = { id, events: [], requests: [], errors: [] };
    report.records.push(result);
    p.on("pageerror", (e) => result.errors.push(e.message));
    p.on("response", (r) => {
      if (r.request().resourceType() === "media")
        result.requests.push({ url: r.url(), status: r.status() });
    });
    await p.goto(base + "/#record/" + id);
    await p.locator(".record-head .primary[data-play]").waitFor();
    result.title = await p.locator(".record-head h1").innerText();
    await p.evaluate(() => {
      window.__mediaEvents = [];
      for (const event of ["playing", "waiting", "stalled", "error"])
        document.querySelector("#audio").addEventListener(event, () => {
          const a = document.querySelector("#audio");
          window.__mediaEvents.push({
            event,
            time: a.currentTime,
            readyState: a.readyState,
            at: performance.now(),
          });
        });
    });
    const start = Date.now();
    await p.locator(".record-head .primary[data-play]").click();
    try {
      await p.waitForFunction(
        () => document.querySelector("#audio").currentTime > 0.5,
        null,
        { timeout: 45000 },
      );
      result.startupMs = Date.now() - start;
      const time = await p.locator("#audio").evaluate((a) => a.currentTime);
      await p.waitForFunction(
        (t) => document.querySelector("#audio").currentTime > t + 2,
        time,
        { timeout: 15000 },
      );
      result.played = true;
    } catch (e) {
      result.played = false;
      result.failure = e.message;
    }
    result.state = await p.locator("#audio").evaluate((a) => ({
      src: a.currentSrc,
      time: a.currentTime,
      duration: a.duration,
      readyState: a.readyState,
      paused: a.paused,
      error: a.error?.message || null,
      buffered: Array.from({ length: a.buffered.length }, (_, i) => [
        a.buffered.start(i),
        a.buffered.end(i),
      ]),
    }));
    result.events = await p.evaluate(() => window.__mediaEvents);
    console.log(
      JSON.stringify({
        title: result.title,
        played: result.played,
        startupMs: result.startupMs,
        state: result.state,
      }),
    );
    await p.close();
  }
} finally {
  await b.close();
  writeFileSync(
    "data/continuous-playback-source-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
}
