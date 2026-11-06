import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
const bundle = JSON.parse(
  readFileSync("data/supercollector/recovered-media.json"),
);
const selected = [
  bundle.records.find((r) => r.title === "OFF THE LEASH"),
  bundle.records[0],
  bundle.records.at(-1),
].filter(Boolean);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const results = [];
try {
  for (const r of selected) {
    await page.goto("about:blank");
    await page.setContent("<audio controls></audio>");
    try {
      await page.evaluate(async (url) => {
        const a = document.querySelector("audio");
        a.src = url;
        await a.play();
      }, bundle.evidence[r.id].mediaURL);
      await page.waitForFunction(
        () => document.querySelector("audio").currentTime > 0.5,
        null,
        { timeout: 20000 },
      );
      results.push({
        id: r.id,
        title: r.title,
        status: "started",
        ...(await page.locator("audio").evaluate((a) => ({
          currentTime: a.currentTime,
          duration: a.duration,
          source: a.currentSrc,
        }))),
      });
    } catch (e) {
      results.push({
        id: r.id,
        title: r.title,
        status: "retryable",
        reason: e.message.slice(0, 200),
      });
    }
  }
} finally {
  await browser.close();
}
writeFileSync(
  "data/supercollector/playback-verification.json",
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      scope:
        "Three public source-media start checks, not full-track auditions or production app integration",
      results,
    },
    null,
    2,
  ) + "\n",
);
console.log(results.map((r) => ({ title: r.title, status: r.status })));
