import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
const first = JSON.parse(
  readFileSync("data/supercollector/recovered-media.json"),
).records.find((r) => r.title === "OFF THE LEASH").id;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(
  ({ first }) => {
    localStorage.setItem("mn-archive-shuffle", "false");
    localStorage.setItem(
      "mn-archive-playlists-v1",
      JSON.stringify([
        {
          id: "cold-validation",
          name: "Cold validation",
          recordIds: [first, "record-69c77ef0"],
        },
      ]),
    );
    window.__media = [];
    const create = document.createElement.bind(document);
    document.createElement = (...args) => {
      const e = create(...args);
      if (["video", "audio"].includes(args[0])) {
        __media.push(e);
        e.__started = 0;
        e.addEventListener("loadstart", () => {
          if (e.getAttribute("src")) e.__started = performance.now();
        });
      }
      return e;
    };
  },
  { first },
);
try {
  await page.goto("http://127.0.0.1:4191/#playlist/cold-validation");
  await page.locator("[data-play-personal]").click();
  await page.waitForFunction(
    () =>
      __media.some((m) =>
        m.src.includes("YPaPFwWrTrMJDwObXBrJfI0sJMybg2gl-H_IhLNAKWs"),
      ),
    null,
    { timeout: 30000 },
  );
  await page.evaluate(() => {
    window.__cold = __media.find((m) =>
      m.src.includes("YPaPFwWrTrMJDwObXBrJfI0sJMybg2gl-H_IhLNAKWs"),
    );
  });
  await page.waitForFunction(
    () =>
      !__cold.getAttribute("src") ||
      (__cold.buffered.length && __cold.buffered.end(0) >= 9.9),
    null,
    { timeout: 24000 },
  );
  const result = await page.evaluate(() => ({
    candidateSourceCleared: !__cold.getAttribute("src"),
    candidateBufferedSeconds: __cold.buffered.length
      ? __cold.buffered.end(0)
      : 0,
    elapsedMs: performance.now() - __cold.__started,
    activePaused: document.querySelector("#audio").paused,
    activeTime: document.querySelector("#audio").currentTime,
    activeReadyState: document.querySelector("#audio").readyState,
  }));
  assert.equal(result.activePaused, false);
  assert.ok(result.activeTime > 1);
  assert.deepEqual(errors, []);
  const report = {
    checkedAt: new Date().toISOString(),
    scope:
      "Real cold Arweave next-track attempt, 20-second candidate deadline; current playback has >=10 seconds buffered headroom",
    candidateTitle: "MIAMI FREESTYLE",
    ...result,
    errors,
  };
  writeFileSync(
    "data/next-track-buffer-cold-source-20s.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
