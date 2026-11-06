import { chromium } from "playwright";
import assert from "node:assert/strict";
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await p.goto("http://127.0.0.1:4190/#record/record-69c77ef0");
await p.locator(".collector-card").first().waitFor({ timeout: 25000 });
assert.ok((await p.locator(".collector-grid .collector-card").count()) > 0);
await p.locator(".collector-card img").first().waitFor();
await p.screenshot({
  path: "captures/song-visible-collectors-desktop.png",
  fullPage: true,
});
await p.getByRole("tab", { name: "Collectors", exact: true }).click();
await p.locator(".collector-grid .collector-card").first().waitFor();
assert.equal(await p.locator(".collector-grid .collector-card").count(), 50);
await p.locator("[data-more-collectors]").click();
await p.waitForFunction(
  () =>
    document.querySelectorAll(".collector-grid .collector-card").length > 50,
  null,
  { timeout: 25000 },
);
console.log(
  "COLLECTORS",
  await p.locator(".collector-grid .collector-card").count(),
);
await p.locator(".collector-grid .collector-card").first().click();
await p.locator(".collector-profile").waitFor();
await p.waitForFunction(
  () => !document.querySelector("#profile-loading"),
  null,
  { timeout: 35000 },
);
console.log("PROFILE", await p.locator(".collector-profile").innerText());
assert.ok((await p.locator(".collector-record").count()) > 0);
await p.screenshot({
  path: "captures/collector-profile-desktop.png",
  fullPage: true,
});
await p.setViewportSize({ width: 390, height: 844 });
await p.screenshot({
  path: "captures/collector-profile-mobile.png",
  fullPage: true,
});
assert.ok(
  await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
);
await p.goto("http://127.0.0.1:4190/#record/record-69c77ef0");
await p.locator(".collector-card").first().waitFor();
await p.screenshot({
  path: "captures/song-visible-collectors-mobile.png",
  fullPage: true,
});
assert.ok(
  await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
);
await p.locator("#theme").click();
await p.screenshot({
  path: "captures/song-visible-collectors-mobile-dark.png",
  fullPage: true,
});
await p.locator("[data-play]").first().click();
await p.waitForFunction(
  () => document.querySelector("#audio").currentTime > 0.5,
  null,
  { timeout: 30000 },
);
console.log("PLAYBACK STILL WORKS");
assert.deepEqual(errors, []);
await b.close();
