import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const go = async (route) => {
  await page.goto("http://127.0.0.1:4190/#" + route);
  await page.locator("main h1").first().waitFor();
};
await go("home");
await page.locator(".artist-grid").scrollIntoViewIfNeeded();
await page.waitForTimeout(1200);
await page.evaluate(() => scrollTo(0, 0));
await page.screenshot({
  path: "captures/archive-home-desktop.png",
  fullPage: true,
});
await page.locator('[data-play="record-69c77ef0"]').click();
await page.waitForFunction(
  () => document.querySelector("#audio").currentTime > 1,
  null,
  { timeout: 30000 },
);
console.log(
  "PLAYBACK",
  await page.locator("#audio").evaluate((a) => ({
    time: a.currentTime,
    duration: a.duration,
    readyState: a.readyState,
    source: a.currentSrc,
  })),
);
await page.locator("#toggle").click();
await page.locator("#search").fill("Pete Rango");
await page.waitForTimeout(300);
assert.ok((await page.locator(".record-card").count()) >= 3);
await page.locator("[data-like]").first().click();
await go("liked");
assert.equal(await page.locator(".record-card").count(), 1);
await go("artist/pete-rango");
assert.ok((await page.locator(".record-card").count()) >= 3);
await go("record/record-69c77ef0?tab=collectors");
await page.getByText("Additional ownership tools", { exact: true }).click();
await page.locator("[data-owner]").click();
await page.locator("#owner-result .owner-row").waitFor({ timeout: 30000 });
console.log("OWNER", await page.locator("#owner-result").innerText());
await page.locator("[data-holders]").click();
await page.locator(".holder").first().waitFor({ timeout: 30000 });
console.log("HOLDERS", await page.locator(".holder").count());
await page.screenshot({
  path: "captures/archive-collectors-desktop.png",
  fullPage: true,
});
await go("record/record-69c77ef0?tab=proof");
await page.locator("[data-recover]").click();
await page.waitForFunction(
  () =>
    document
      .querySelector("#verify-status")
      ?.textContent.includes("Last successful"),
  null,
  { timeout: 45000 },
);
await page.screenshot({
  path: "captures/archive-provenance-desktop.png",
  fullPage: true,
});
await go("historic-playlists");
await page.locator(".track-row").first().waitFor();
assert.equal(await page.locator(".track-row").count(), 23);
await go("community");
await page.locator(".comment").first().waitFor();
assert.ok((await page.locator(".comment").count()) >= 100);
await page.setViewportSize({ width: 390, height: 844 });
for (const route of [
  "home",
  "artist/pete-rango",
  "record/record-69c77ef0?tab=proof",
  "playlists",
  "recovery",
]) {
  await go(route);
  await page.waitForTimeout(300);
  const dims = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  assert.ok(dims.scroll <= dims.width, JSON.stringify({ route, ...dims }));
  await page.screenshot({
    path: "captures/archive-mobile-" + route.split("/")[0] + ".png",
    fullPage: true,
  });
}
await go("home");
await page.locator("#theme").click();
await page.screenshot({
  path: "captures/archive-mobile-dark.png",
  fullPage: true,
});
await page.setViewportSize({ width: 1440, height: 1050 });
await page.screenshot({
  path: "captures/archive-desktop-dark.png",
  fullPage: true,
});
assert.deepEqual(errors, []);
console.log(
  "PASS: playback, search, saved likes, Pete credits, live owner and holders, contract reread, playlist, comments, five mobile routes, dark theme",
);
await browser.close();
