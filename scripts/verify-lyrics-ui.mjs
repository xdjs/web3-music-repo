import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.ARCHIVE_QA_URL || "http://127.0.0.1:4191";
const browser = await chromium.launch({ headless: true }),
  page = await browser.newPage(),
  errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  const data = await (await page.request.get(base + "/api/catalog")).json();
  const lyrics = data.records.filter((r) => r.musicMetadata?.lyrics?.length);
  const sample = lyrics.find(
    (r) =>
      r.musicMetadata.lyrics[0].text.split("\n").length > 4 &&
      r.musicMetadata.lyrics[0].text.length > 280,
  );
  assert.ok(
    sample,
    "Real cached lyrics must be re-extracted before browser verification",
  );
  const none = data.records.find((r) => !r.musicMetadata?.lyrics?.length);
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript(
        (t) => localStorage.setItem("mn-archive-theme", t),
        theme,
      );
      await page.goto(
        base + `/?qa=lyrics-${width}-${theme}#record/` + sample.id,
      );
      const section = page.locator("[data-lyrics]").first(),
        panel = section.locator(".lyrics-panel"),
        summary = panel.locator("summary");
      await section.waitFor();
      assert.equal(await panel.getAttribute("open"), null);
      assert.equal(await section.locator(".lyrics-preview").isVisible(), true);
      await summary.focus();
      await page.keyboard.press("Enter");
      assert.notEqual(await panel.getAttribute("open"), null);
      assert.equal(await section.locator(".lyrics-preview").isVisible(), false);
      assert.equal(
        await panel.locator(".original-lyrics").textContent(),
        sample.musicMetadata.lyrics[0].text,
      );
      assert.equal(
        await panel
          .locator(".original-lyrics")
          .evaluate((node) => getComputedStyle(node).whiteSpace),
        "pre-line",
      );
      await section.evaluate((node) => {
        node.scrollIntoView({ block: "start" });
        window.scrollBy(0, -110);
      });
      await page.screenshot({ path: `captures/lyrics-${width}-${theme}.png` });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await summary.click();
      assert.equal(await panel.getAttribute("open"), null);
      assert.equal(await section.locator(".lyrics-preview").isVisible(), true);
      assert.ok(await section.locator('a[href^="http"]').count());
      await page.goto(base + "/#record/" + none.id);
      await page.getByRole("heading", { name: "Behind the music" }).waitFor();
      assert.equal(await page.locator("[data-lyrics]").count(), 0);
      checks.push({
        width,
        theme,
        inlinePreview: true,
        keyboardExpand: true,
        originalLineBreaks: true,
        collapse: true,
        sourceLink: true,
        absentWhenUnrecovered: true,
        noOverflow: true,
      });
    }
  assert.deepEqual(errors, []);
  const result = {
    checkedAt: new Date().toISOString(),
    base,
    record: sample.id,
    recordsWithLyrics: lyrics.length,
    checks,
    errors,
  };
  writeFileSync(
    "data/lyrics-ui-verification.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
