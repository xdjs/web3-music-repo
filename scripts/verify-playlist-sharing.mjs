import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { createPlaylistShareURL } from "../src/playlist-share.mjs";
const base = process.env.BASE_URL || "http://127.0.0.1:4191";
const browser = await chromium.launch({ headless: true });
const errors = [],
  checks = [];
const owner = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
await owner.addInitScript(() => {
  Object.defineProperty(navigator, "share", {
    value: undefined,
    configurable: true,
  });
  Object.defineProperty(navigator, "clipboard", {
    value: undefined,
    configurable: true,
  });
});
const p = await owner.newPage();
p.on("pageerror", (e) => errors.push(e.message));
const go = async (page, hash) => {
  await page.goto(`${base}/#${hash}`);
  await page.locator("main h1").waitFor();
};
try {
  await go(p, "playlists");
  await p.locator("[data-new-playlist]").click();
  const title = "After hours 🎧 <friends>";
  await p.locator("[name=name]").fill(title);
  await p.getByRole("button", { name: "Save playlist", exact: true }).click();
  await p.getByRole("heading", { name: title, exact: true }).waitFor();
  const personalHash = await p.evaluate(() => location.hash.slice(1));
  for (const id of ["record-69c77ef0", "record-not4me"]) {
    await go(p, "record/" + id);
    await p.locator("[data-add-playlist]").click();
    await p.locator("[name=existing]").selectOption({ label: title });
    await p.getByRole("button", { name: "Add recording", exact: true }).click();
  }
  await go(p, personalHash);
  await p.locator(".personal-track [data-like]").first().click();
  assert.equal(
    await p
      .locator(".personal-track [data-like]")
      .first()
      .getAttribute("class"),
    "icon heart active",
  );
  await p.reload();
  await p.locator(".personal-track").first().waitFor();
  assert.match(
    await p
      .locator(".personal-track [data-like]")
      .first()
      .getAttribute("class"),
    /active/,
  );
  await p.locator("[data-share-playlist]").click();
  await p.locator("[name=shareLink]").waitFor();
  const shareURL = await p.locator("[name=shareLink]").inputValue();
  assert.match(shareURL, /#shared-playlist\/v1\./);
  await p.getByRole("button", { name: "Done", exact: true }).click();
  checks.push(
    "Create/add/like persists, manual share fallback exposes snapshot link",
  );
  const recipient = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const r = await recipient.newPage();
  r.on("pageerror", (e) => errors.push(e.message));
  await r.goto(shareURL);
  await r.getByRole("heading", { name: title, exact: true }).waitFor();
  assert.equal(await r.locator(".personal-track").count(), 2);
  assert.equal(
    await r
      .locator(
        "[data-rename-playlist],[data-delete-playlist],[data-remove-track]",
      )
      .count(),
    0,
  );
  assert.equal(
    await r.evaluate(() => localStorage.getItem("mn-archive-playlists-v1")),
    null,
  );
  assert.equal(await r.locator("main friends").count(), 0);
  await r.locator("[data-play-snapshot]").first().click();
  await r.waitForFunction(
    () => document.querySelector("#audio").currentTime > 0.5,
    null,
    { timeout: 45000 },
  );
  assert.match(await r.locator("#player-title").innerText(), /MIAMI/);
  checks.push(
    "Fresh recipient opens escaped read-only snapshot and starts actual original MIAMI media",
  );
  await r.locator("#next").click();
  await r.waitForFunction(() =>
    document.querySelector("#player-title").textContent.includes("NOT4ME"),
  );
  checks.push("Shared playlist Next selects second track in preserved order");
  await r.locator("[data-save-snapshot]").click();
  await r.locator("[data-rename-playlist]").waitFor();
  assert.equal(await r.locator(".personal-track").count(), 2);
  await r.locator("[data-rename-playlist]").click();
  await r.locator("[name=name]").fill("My independent copy");
  await r.getByRole("button", { name: "Save playlist", exact: true }).click();
  await r
    .getByRole("heading", { name: "My independent copy", exact: true })
    .waitFor();
  await r.reload();
  await r
    .getByRole("heading", { name: "My independent copy", exact: true })
    .waitFor();
  await r.goto(shareURL);
  await r.getByRole("heading", { name: title, exact: true }).waitFor();
  checks.push(
    "Recipient saves and edits independent copy; original shared snapshot unchanged",
  );
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      await r.setViewportSize({ width, height: 1000 });
      await r.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      assert.ok(
        await r.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await r.screenshot({
        path: `captures/shared-playlist-${width}-${theme}.png`,
        fullPage: true,
      });
    }
  const missingURL = await createPlaylistShareURL(
    {
      name: "Partial playlist",
      recordIds: ["unknown-track", "record-69c77ef0", "record-69c77ef0"],
    },
    base,
  );
  await r.goto(missingURL);
  await r.getByRole("heading", { name: "Partial playlist" }).waitFor();
  assert.match(await r.locator("main").innerText(), /3 tracks · 2 matched/);
  assert.equal(await r.locator('[data-snapshot-index="0"]').count(), 0);
  await r.locator('[data-snapshot-index="2"]').click();
  await r.waitForFunction(() =>
    document.querySelector("#player-title").textContent.includes("MIAMI"),
  );
  await r.goto(`${base}/#shared-playlist/v1.invalid`);
  await r.getByRole("heading", { name: "Playlist link unavailable" }).waitFor();
  checks.push(
    "Unknown tracks remain visible without play; repeated IDs selectable; invalid links handled",
  );
  await go(p, "historic-playlists");
  await p
    .locator(
      '[data-play-snapshot="historic-04150d7a-d471-48de-a144-54b00474e59f"]',
    )
    .waitFor();
  const firstId = await p
    .locator(".track-row [data-play]")
    .first()
    .getAttribute("data-play");
  await p
    .locator(
      '[data-play-snapshot="historic-04150d7a-d471-48de-a144-54b00474e59f"]',
    )
    .click();
  await p.waitForFunction(
    () => document.querySelector("#audio").currentTime > 0.5,
    null,
    { timeout: 45000 },
  );
  const historicPlaying = await p.locator("#player-title").innerText();
  await p.locator(".track-row [data-like]").first().click();
  assert.match(
    await p.locator(".track-row [data-like]").first().getAttribute("class"),
    /active/,
  );
  const matched = await p.locator(".track-row [data-play]").count();
  await p
    .locator(
      '[data-save-snapshot="historic-04150d7a-d471-48de-a144-54b00474e59f"]',
    )
    .click();
  await p.locator("[data-rename-playlist]").waitFor();
  assert.equal(await p.locator(".personal-track").count(), matched);
  const saved = await p.evaluate(() =>
    JSON.parse(localStorage.getItem("mn-archive-playlists-v1")).at(-1),
  );
  assert.equal(saved.recordIds[0], firstId);
  checks.push(
    `Historical playlist starts actual media (${historicPlaying}), likes and saves ${matched} matched tracks in order`,
  );
  await p.setViewportSize({ width: 390, height: 1000 });
  await go(p, "historic-playlists");
  for (const theme of ["light", "dark"]) {
    await p.evaluate(
      (theme) => (document.documentElement.dataset.theme = theme),
      theme,
    );
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await p.screenshot({
      path: `captures/historic-playlist-390-${theme}.png`,
      fullPage: true,
    });
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    "data/playlist-sharing-verification.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        base,
        status: "passed",
        checks,
        errors,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ status: "passed", checks }));
} finally {
  await browser.close();
}
