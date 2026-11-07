import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
const base = process.env.BASE_URL || "http://127.0.0.1:4191",
  video = readFileSync("public/media/planet-x-artist-corrected-720.mp4");
const b = await chromium.launch();
const report = {
  checkedAt: new Date().toISOString(),
  base,
  scope:
    "Actual catalog/UI and local anonymous playlist writes in isolated browser contexts. Media requests use the approved local MP4 fixture for deterministic queue and pause-race checks. Export play/error events injected specifically for race test; actual export encoding is verified separately.",
  cases: [],
};
try {
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      const context = await b.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        isMobile: width === 390,
        hasTouch: width === 390,
      });
      await context.route("**/*", (r) =>
        r.request().resourceType() === "media"
          ? r.fulfill({ contentType: "video/mp4", body: video })
          : r.continue(),
      );
      const p = await context.newPage();
      const c = { width, theme, errors: [] };
      report.cases.push(c);
      p.on("pageerror", (e) => c.errors.push(e.message));
      await p.goto(base + "/#explore");
      await p.locator(".record-card [data-add-playlist]").first().waitFor();
      await p.evaluate(
        (t) => (document.documentElement.dataset.theme = t),
        theme,
      );
      const id = await p
        .locator(".record-card [data-add-playlist]")
        .first()
        .getAttribute("data-add-playlist");
      await p.screenshot({
        path: `captures/card-playlist-actions-${width}-${theme}.png`,
      });
      await p.locator(".record-card [data-add-playlist]").first().click();
      await p.locator("#playlist-editor[open]").waitFor();
      assert.equal(new URL(p.url()).hash, "#explore");
      await p
        .locator('#playlist-editor input[name="name"]')
        .fill("Card action QA");
      await p.locator('#playlist-editor button[type="submit"]').click();
      assert.equal(new URL(p.url()).hash, "#explore");
      assert.ok(
        await p.evaluate(
          (id) =>
            JSON.parse(localStorage.getItem("mn-archive-playlists-v1")).some(
              (x) => x.recordIds.includes(id),
            ),
          id,
        ),
      );
      c.cardSavedWithoutNavigation = true;
      await p.locator(".record-card .card-meta > a").first().click();
      await p.locator(".artist-identity").waitFor();
      const artistHash = new URL(p.url()).hash;
      await p.locator(".record-card [data-add-playlist]").first().click();
      await p.locator("#playlist-editor[open]").waitFor();
      assert.equal(new URL(p.url()).hash, artistHash);
      await p.locator("#playlist-editor [data-cancel]").first().click();
      c.artistPicker = true;
      await p.evaluate(() => (location.hash = "record/record-1956ba25"));
      await p.locator(".record-head .primary[data-play]").click();
      await p.waitForFunction(
        () =>
          document.querySelector("#audio").currentTime > 0.3 &&
          !document.querySelector("#audio").paused,
      );
      await p.locator(width === 390 ? "#mobile-queue" : "#show-queue").click();
      await p.locator("#queue-list [data-add-playlist]").first().click();
      await p.locator("#playlist-editor[open]").waitFor();
      assert.equal(new URL(p.url()).hash, "#record/record-1956ba25");
      await p.locator("#playlist-editor [data-cancel]").first().click();
      await p.screenshot({
        path: `captures/queue-playlist-actions-${width}-${theme}.png`,
      });
      await p.locator("#queue-dialog [data-close]").click();
      c.queuePicker = true;
      if (width === 1440 && theme === "light") {
        await p.locator("[data-story-export]").click();
        await p.locator("#story-export-dialog[open]").waitFor();
        await p.evaluate(() => {
          document
            .querySelector("[data-story-result]")
            .dispatchEvent(new Event("play", { bubbles: true }));
          window.__pausedRecord = document
            .querySelector("#player-title")
            .getAttribute("href");
          const a = document.querySelector("#audio");
          window.__autoPlayCalls = 0;
          const play = a.play.bind(a);
          a.play = () => {
            window.__autoPlayCalls++;
            return play();
          };
          a.dispatchEvent(new Event("error"));
          a.dispatchEvent(new Event("error"));
        });
        await p.waitForTimeout(3500);
        assert.equal(await p.locator("#audio").evaluate((a) => a.paused), true);
        assert.equal(await p.evaluate(() => window.__autoPlayCalls), 0);
        assert.equal(
          await p.locator("#player-title").getAttribute("href"),
          "#record/record-1956ba25",
        );
        c.lateErrorAfterExportPauseDoesNotAdvance = true;
        await p.locator("[data-story-close]").click();
        await p.locator("#toggle").click();
        await p.waitForFunction(
          () =>
            !document.querySelector("#audio").paused &&
            document.querySelector("#audio").currentTime > 0.3,
        );
        c.explicitResumeWorks = true;
      }
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      assert.deepEqual(c.errors, []);
      c.passed = true;
      await context.close();
    }
  report.passed = true;
} catch (e) {
  report.passed = false;
  report.error = e.stack;
  throw e;
} finally {
  await b.close();
  writeFileSync(
    "data/card-playlist-actions-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
