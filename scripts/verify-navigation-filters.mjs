import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.BASE_URL || "http://127.0.0.1:4191";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  const payload = await (await page.request.get(base + "/api/catalog")).json();
  assert.equal(payload.records.filter((r) => r.kind === "artwork").length, 0);
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + "/#explore");
      await page.locator(".filter-toolbar").waitFor();
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      assert.equal(await page.locator(".more-filters").count(), 0);
      assert.equal(await page.locator(".filter-toolbar select").count(), 4);
      assert.equal(
        await page
          .locator('[data-facet="media"] option[value="artwork"]')
          .count(),
        0,
      );
      for (const direction of ["oldest", "newest"]) {
        await page.locator('[data-facet="sort"]').selectOption(direction);
        const ordered = [...payload.records].sort((a, b) => {
          const l = a.releaseDate?.timestamp,
            r = b.releaseDate?.timestamp;
          if (l === undefined && r !== undefined) return 1;
          if (r === undefined && l !== undefined) return -1;
          return l !== undefined && r !== undefined && l !== r
            ? direction === "oldest"
              ? l - r
              : r - l
            : a.id.localeCompare(b.id);
        });
        assert.equal(
          await page
            .locator(".record-card .cover>a")
            .first()
            .getAttribute("href"),
          "#record/" + ordered[0].id,
        );
      }
      await page.screenshot({ path: `captures/filters-${width}-${theme}.png` });
      await page.locator("[data-clear-filters]").click();
      await page
        .locator(
          (width === 390 ? ".mobile-nav " : ".sidebar ") +
            '[data-nav="artists"]',
        )
        .click();
      await page
        .getByRole("heading", { name: "Artists", exact: true })
        .waitFor();
      assert.ok(
        await page
          .locator(
            (width === 390 ? ".mobile-nav " : ".sidebar ") +
              '[data-nav="explore"] svg',
          )
          .count(),
      );
      await page.screenshot({
        path: `captures/navigation-${width}-${theme}.png`,
      });
      await page.goto(base + "/#record/record-69c77ef0");
      await page.locator(".record-head").waitFor();
      await page.locator(".record-head [data-play]").click();
      await page.locator("#player:not([hidden])").waitFor();
      assert.equal(await page.locator("#mute svg").count(), 1);
      if (width === 1440) {
        await page.locator("#mute").click();
        assert.equal(
          await page.locator("#audio").evaluate((el) => el.muted),
          true,
        );
        assert.equal(
          await page.locator("#mute").getAttribute("aria-label"),
          "Unmute audio",
        );
        await page.locator("#mute").click();
        assert.equal(
          await page.locator("#audio").evaluate((el) => el.muted),
          false,
        );
      } else assert.equal(await page.locator("#mute").isVisible(), false);
      await page.locator("#audio").evaluate((el) => el.pause());
      await page.screenshot({
        path: `captures/player-controls-${width}-${theme}.png`,
      });
      const dimensions = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      assert.ok(dimensions.scroll <= dimensions.width);
      checks.push({
        width,
        theme,
        sort: "oldest+newest",
        artwork: 0,
        icons: "svg",
        mute: width === 1440 ? "pass" : "hidden-mobile",
        overflow: false,
      });
    }
  assert.deepEqual(errors, []);
  writeFileSync(
    "data/navigation-filter-verification.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        base,
        passed: true,
        checks,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: true, checks }));
} finally {
  await browser.close();
}
