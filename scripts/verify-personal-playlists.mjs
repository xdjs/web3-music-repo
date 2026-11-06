import { chromium } from "playwright";
import assert from "node:assert/strict";
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
const go = async (s) => {
  await p.goto("http://127.0.0.1:4190/#" + s);
  await p.locator("main h1").waitFor();
};
await go("playlists");
await p.locator("[data-new-playlist]").click();
await p.locator("[name=name]").fill("Sounds that survived");
await p.getByRole("button", { name: "Save playlist", exact: true }).click();
await p.getByRole("heading", { name: "Sounds that survived" }).waitFor();
const hash = await p.evaluate(() => location.hash);
for (const id of ["record-69c77ef0", "record-not4me"]) {
  await go("record/" + id);
  await p.locator("[data-add-playlist]").click();
  await p
    .locator("[name=existing]")
    .selectOption({ label: "Sounds that survived" });
  await p.getByRole("button", { name: "Add recording", exact: true }).click();
}
await go(hash.slice(1));
assert.equal(await p.locator(".personal-track").count(), 2);
await p.getByRole("button", { name: "Move track 2 up" }).click();
assert.match(await p.locator(".personal-track").first().innerText(), /NOT4ME/);
await p.reload();
await p.locator(".personal-track").first().waitFor();
assert.match(await p.locator(".personal-track").first().innerText(), /NOT4ME/);
await p.locator("[data-rename-playlist]").click();
await p.locator("[name=name]").fill("My recovered era");
await p.getByRole("button", { name: "Save playlist", exact: true }).click();
await p.getByRole("heading", { name: "My recovered era" }).waitFor();
await p.locator("[data-play-personal]").click();
await p.waitForFunction(
  () => document.querySelector("#audio").currentTime > 0.5,
  null,
  { timeout: 40000 },
);
console.log(
  "PLAYLIST_PLAYBACK",
  await p.locator("#audio").evaluate((a) => ({
    source: a.currentSrc,
    duration: a.duration,
    time: a.currentTime,
  })),
);
await p.locator("#next").click();
await p.waitForFunction(
  () =>
    document.querySelector("#player-title").textContent.includes("MIAMI") &&
    document.querySelector("#audio").currentTime > 0.5,
  null,
  { timeout: 30000 },
);
await p.locator("#toggle").click();
await p.screenshot({
  path: "captures/archive-personal-playlist.png",
  fullPage: true,
});
await p.setViewportSize({ width: 390, height: 844 });
await p.locator("#mobile-queue").click();
assert.equal(await p.locator(".queue-item").count(), 2);
await p.getByRole("button", { name: "Close queue", exact: true }).click();
await p.screenshot({
  path: "captures/archive-personal-playlist-mobile.png",
  fullPage: true,
});
assert.ok(
  await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
);
await go("artist/jamee-cornelia");
await p.getByRole("link", { name: "Artist site & socials" }).waitFor();
await p.screenshot({
  path: "captures/archive-artist-links-mobile.png",
  fullPage: true,
});
await go(hash.slice(1));
await p.getByRole("button", { name: "Remove track 1" }).click();
assert.equal(await p.locator(".personal-track").count(), 1);
await p.locator("[data-delete-playlist]").click();
await p.locator("#cancel-delete").click();
assert.equal(await p.locator(".personal-track").count(), 1);
await p.locator("[data-delete-playlist]").click();
await p.locator("#confirm-delete").click();
await p.getByRole("heading", { name: "Your playlists" }).waitFor();
assert.equal(await p.locator(".personal-playlist-card").count(), 0);
assert.deepEqual(errors, []);
console.log(
  "PASS playlist create/add/reorder/reload/rename/play/next/mobile queue/remove/delete and artist links",
);
await b.close();
