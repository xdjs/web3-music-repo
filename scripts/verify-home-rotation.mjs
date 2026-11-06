const { chromium } = await import("playwright");
const { writeFileSync, readFileSync } = await import("node:fs");
const assert = (await import("node:assert/strict")).default;
const base = process.env.ARCHIVE_QA_URL || "http://127.0.0.1:4191";
const browser = await chromium.launch();
const request = await browser.newContext();
const data = await (
  await request.request.get(base + "/api/catalog?view=index")
).json();
await request.close();
const preferred = [
  "record-69c77ef0",
  "record-not4me",
  "record-e6516778",
  "record-28b708ee",
  "record-b31b7bac",
  "park-sound-rainwater",
  "record-00396a23",
].filter((id) => data.records.find((r) => r.id === id)?.playback?.workingURL);
const sara = data.records.find(
  (r) => preferred.includes(r.id) && /sara/i.test(r.artist),
);
const ids = [preferred[0], preferred[1], sara?.id || preferred[2]];
const report = {
  checkedAt: new Date().toISOString(),
  base,
  scope:
    "Actual app with deterministic injected selection random values only to exercise curated hero variants; reload and revisit use actual selection/storage behavior.",
  cases: [],
};
try {
  for (const width of [1440, 390])
    for (const id of ids) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        isMobile: width === 390,
        hasTouch: width === 390,
      });
      const index = preferred.indexOf(id),
        sequence = Array.from({ length: preferred.length - 1 }, (_, step) =>
          preferred.length - 1 - step === index && index > 0 ? 0 : 0.999,
        );
      await context.addInitScript((seq) => {
        let n = 0;
        window.__homeRandom = () => seq[n++] ?? 0.45;
      }, sequence);
      await context.route("**/src/home-selection.mjs", (r) =>
        r.fulfill({
          contentType: "application/javascript",
          body: readFileSync("src/home-selection.mjs", "utf8").replace(
            "random = Math.random",
            "random = () => window.__homeRandom()",
          ),
        }),
      );
      const p = await context.newPage();
      const c = {
        width,
        id,
        title: data.records.find((r) => r.id === id).title,
        errors: [],
      };
      report.cases.push(c);
      p.on("pageerror", (e) => c.errors.push(e.message));
      await p.goto(base + "/#home");
      await p.locator(".hero [data-play]").waitFor();
      c.actualHero = await p
        .locator(".hero [data-play]")
        .getAttribute("data-play");
      assert.equal(c.actualHero, id);
      const artistLinks = await p
        .locator("#main .artist-grid .artist-card")
        .evaluateAll((ns) => ns.map((n) => n.getAttribute("href")));
      assert.equal(artistLinks.length, 7);
      assert.equal(new Set(artistLinks).size, 7);
      assert.ok(
        artistLinks.every((link) =>
          data.people.some((p) => "#artist/" + p.id === link),
        ),
      );
      for (const theme of ["light", "dark"]) {
        await p.evaluate(
          (t) => (document.documentElement.dataset.theme = t),
          theme,
        );
        await p.screenshot({
          path: `captures/home-rotation-${id}-${width}-${theme}.png`,
        });
        const boxes = await p.evaluate(() => {
          const h = document.querySelector(".hero"),
            title = h.querySelector("h2"),
            actions = h.querySelector(".hero-actions"),
            bottom = h.querySelector(".hero-bottom");
          return {
            overflow: document.documentElement.scrollWidth > innerWidth,
            hero: h.getBoundingClientRect().toJSON(),
            title: title.getBoundingClientRect().toJSON(),
            actions: actions.getBoundingClientRect().toJSON(),
            bottom: bottom.getBoundingClientRect().toJSON(),
          };
        });
        c[theme] = boxes;
        assert.equal(boxes.overflow, false);
        assert.ok(
          boxes.actions.bottom <= boxes.bottom.top + 1,
          "hero controls overlap footer",
        );
        if (id === ids[0]) {
          await p
            .locator("#main .artist-grid")
            .evaluate((el) =>
              scrollTo(0, el.getBoundingClientRect().top + scrollY - 150),
            );
          await p.screenshot({
            path: `captures/home-artists-${width}-${theme}.png`,
          });
          await p.evaluate(() => scrollTo(0, 0));
        }
      }
      await p.locator("#main .artist-grid .artist-card").first().click();
      await p.locator(".artist-identity h1").waitFor();
      c.artistLinkWorks = true;
      await p.evaluate(() => (location.hash = "home"));
      await p.locator(".hero [data-play]").waitFor();
      assert.equal(
        await p.locator(".hero [data-play]").getAttribute("data-play"),
        id,
      );
      assert.deepEqual(
        await p
          .locator("#main .artist-grid .artist-card")
          .evaluateAll((ns) => ns.map((n) => n.getAttribute("href"))),
        artistLinks,
      );
      c.revisitStable = true;
      await p.reload();
      await p.locator(".hero [data-play]").waitFor();
      c.afterReload = await p
        .locator(".hero [data-play]")
        .getAttribute("data-play");
      assert.notEqual(c.afterReload, id);
      c.afterArtists = await p
        .locator("#main .artist-grid .artist-card")
        .evaluateAll((ns) => ns.map((n) => n.getAttribute("href")));
      assert.notDeepEqual(c.afterArtists, artistLinks);
      assert.deepEqual(c.errors, []);
      c.passed = true;
      await context.close();
    }
  report.passed = true;
} catch (e) {
  report.error = e.stack;
  report.passed = false;
  throw e;
} finally {
  await browser.close();
  writeFileSync(
    "data/home-rotation-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
