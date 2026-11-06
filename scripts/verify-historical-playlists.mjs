import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.BASE_URL || "http://127.0.0.1:4191";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [],
  results = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  const { playlists } = await page.request
    .get(base + "/api/archive")
    .then((r) => r.json());
  assert.equal(playlists.length, 4);
  await page.goto(base + "/#historic-playlists");
  await page.locator(".historical-playlist-picker a").first().waitFor();
  assert.equal(await page.locator(".historical-playlist-picker a").count(), 4);
  for (const p of playlists) {
    await page
      .locator(
        `.historical-playlist-picker a[href="#historic-playlists/${p.id}"]`,
      )
      .click();
    await page
      .locator(".playlist-feature h2")
      .filter({ hasText: p.name })
      .waitFor();
    assert.equal(
      await page
        .locator('.historical-playlist-picker [aria-current="page"]')
        .innerText(),
      p.name,
    );
    await page.reload();
    await page
      .locator(".playlist-feature h2")
      .filter({ hasText: p.name })
      .waitFor();
    assert.equal(await page.locator(".track-row").count(), p.tracks.length);
    const recovered = p.tracks.filter((t) => !t.missing).length;
    assert.match(
      await page.locator(".playlist-feature").innerText(),
      new RegExp(`${recovered} track details recovered`),
    );
    const ids = await page
      .locator(".track-row [data-play]")
      .evaluateAll((nodes) => nodes.map((n) => n.dataset.play));
    for (const width of [1440, 390])
      for (const theme of ["light", "dark"]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(
          (t) => (document.documentElement.dataset.theme = t),
          theme,
        );
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${p.name} overflow ${width} ${theme}`,
        );
        await page.screenshot({
          path: `captures/historic-${p.id}-${width}-${theme}.png`,
          fullPage: true,
        });
      }
    await page.locator(`[data-save-snapshot="historic-${p.id}"]`).click();
    await page.locator("[data-rename-playlist]").waitFor();
    assert.equal(await page.locator(".personal-track").count(), ids.length);
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("mn-archive-playlists-v1")).at(-1),
    );
    assert.deepEqual(saved.recordIds, ids);
    assert.equal(saved.name, p.name);
    results.push({
      id: p.id,
      name: p.name,
      preservedIDs: p.tracks.length,
      recoveredDetails: recovered,
      catalogMatches: ids.length,
      directLinkReload: true,
      savedCopyOrdered: true,
      themes: ["light", "dark"],
      viewports: [1440, 390],
    });
    await page.goto(base + "/#historic-playlists");
    await page.locator(".historical-playlist-picker a").first().waitFor();
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    "data/historical-playlists-verification.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        base,
        status: "passed",
        results,
        errors,
        note: "No media playback repeated. Prior original-media playback checks recorded separately in playlist-sharing-verification.json.",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
