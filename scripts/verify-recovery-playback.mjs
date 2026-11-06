import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
const base = process.env.VERIFY_BASE_URL || "http://127.0.0.1:4190";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const cases = [
  ["rush", "pete-zora-coin-base-c01f464c55f5b1bec05db5205d2fae9e6a835a5e"],
  ["mint-songs", "mint-songs-1-2b5426a5b98a3e366230eba9f95a24f09ae4a584-7"],
  ["sound", "recovered-sound-1-b2cb781aa0b35aec7acef3f9751b61505fd5715a"],
  ["catalog", "catalog-1-0bc2a24ce568dad89691116d5b34deb6c203f342-52"],
];
const report = {
  checkedAt: new Date().toISOString(),
  base,
  scope: "Four selected releases; not an all-track playback audit.",
  playback: [],
  rendering: [],
  errors,
};
try {
  for (const [name, id] of cases) {
    await page.goto(`${base}/#record/${id}`);
    await page.locator("main h1").waitFor();
    await page.locator(`[data-play="${id}"]`).first().click();
    let failure = null;
    try {
      await page.waitForFunction(
        () => document.querySelector("#audio")?.currentTime > 1,
        null,
        { timeout: 50000 },
      );
    } catch (e) {
      failure = e.message.split("\n")[0];
    }
    const observed = await page.locator("#audio").evaluate((a) => ({
      time: a.currentTime,
      duration: Number.isFinite(a.duration) ? a.duration : null,
      readyState: a.readyState,
      source: a.currentSrc,
      error: a.error ? { code: a.error.code, message: a.error.message } : null,
      video: a.classList.contains("video-visible"),
    }));
    const status = await page.locator("#player-source").innerText();
    const result = { name, id, passed: !failure, ...observed, status, failure };
    report.playback.push(result);
    console.log(JSON.stringify(result));
    await page.locator("#audio").evaluate((a) => a.pause());
  }
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"])
      for (const [name, id] of cases.slice(0, 2)) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(`${base}/#record/${id}`);
        await page.locator("main h1").waitFor();
        await page.evaluate(
          (t) => (document.documentElement.dataset.theme = t),
          theme,
        );
        await page.waitForTimeout(1000);
        const observed = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth,
          title: document.querySelector("main h1")?.textContent,
          brokenImages: [...document.querySelectorAll("main img")]
            .filter((i) => i.complete && !i.naturalWidth)
            .map((i) => i.src),
          headings: [...document.querySelectorAll("main h1,main h2")].map(
            (h) => h.textContent,
          ),
        }));
        const screenshot = `captures/recovery-${name}-${width}-${theme}.png`;
        await page.screenshot({ path: screenshot, fullPage: true });
        report.rendering.push({
          name,
          id,
          width,
          theme,
          ...observed,
          screenshot,
        });
      }
  for (const [name, id] of cases.slice(0, 2)) {
    await page.goto(`${base}/#record/${id}?tab=collectors`);
    await page.locator("main h1").waitFor();
    const text = await page.locator("main").innerText();
    report.rendering.push({ name, tab: "collectors", text: text.slice(-1800) });
  }
} finally {
  writeFileSync(
    "data/recovery-playback-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  await browser.close();
}
