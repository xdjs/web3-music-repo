import { chromium } from "playwright";
import assert from "node:assert/strict";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto("http://127.0.0.1:4178/");
await p.getByRole("button", { name: "Listen first" }).click();
const f = p.frameLocator("#player iframe");
await f.locator("audio").waitFor({ state: "attached" });
console.log(
  "initial",
  await f
    .locator("audio")
    .evaluate((a) => ({ paused: a.paused, time: a.currentTime })),
);
assert.equal(await f.locator("audio").evaluate((a) => a.paused), true);
await f.locator("#big_play_button").click();
await p.waitForTimeout(3000);
const playing = await f
  .locator("audio")
  .evaluate((a) => ({ paused: a.paused, time: a.currentTime }));
console.log("playing", playing);
assert.equal(playing.paused, false);
assert(playing.time > 0);
await f.locator("#big_play_button").click();
const paused = await f
  .locator("audio")
  .evaluate((a) => ({ paused: a.paused, time: a.currentTime }));
await p.waitForTimeout(1000);
assert.equal(
  await f.locator("audio").evaluate((a) => a.currentTime),
  paused.time,
);
assert.equal(paused.paused, true);
console.log("paused", paused);
await p.screenshot({ path: "captures/listening-phone.png" });
await p.getByRole("button", { name: "Stop & close" }).click();
assert.equal(await p.locator("iframe").count(), 0);
await p.goto("http://127.0.0.1:4178/#/moment/remix?person=three-oscillators");
await p.getByText("Identity checked live against").waitFor();
await p.screenshot({ path: "captures/live-directory-phone.png" });
console.log("live directory confirmed");
await b.close();
