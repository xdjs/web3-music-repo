import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
const base = process.env.BASE_URL || "http://127.0.0.1:4191";
const video = readFileSync("public/media/planet-x-artist-corrected-720.mp4");
const ids = [
  "pete-zora-1-10d32bf55f5cbe66b068f2109ecf7475f0631d53-1",
  "record-not4me",
];
const b = await chromium.launch();
const report = {
  checkedAt: new Date().toISOString(),
  base,
  scope:
    "Actual app/catalog/queue UI. Media responses use the existing approved local Planet X MP4 as an explicit deterministic fixture; this suite verifies queue semantics and native continuity, not source attribution/playability.",
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
      await context.addInitScript(
        ({ ids }) => {
          localStorage.setItem("mn-archive-autoplay", "true");
          localStorage.setItem(
            "mn-archive-playlists-v1",
            JSON.stringify([
              {
                id: "autoplay-test",
                name: "Autoplay test",
                recordIds: [ids[1], ids[0], ids[1]],
              },
            ]),
          );
        },
        { ids },
      );
      await context.route("**/*", (route) =>
        route.request().resourceType() === "media"
          ? route.fulfill({ contentType: "video/mp4", body: video })
          : route.continue(),
      );
      const p = await context.newPage();
      const c = { width, theme, errors: [] };
      report.cases.push(c);
      p.on("pageerror", (e) => c.errors.push(e.message));
      const openQueue = async () => {
        await p
          .locator(width === 390 ? "#mobile-queue" : "#show-queue")
          .click();
        await p.locator("#queue-dialog").waitFor();
      };
      const queueIds = () =>
        p
          .locator("#queue-list [data-play-record]")
          .evaluateAll((ns) => ns.map((n) => n.dataset.playRecord));
      await p.goto(base + "/#explore");
      await p.locator(".library-grid .record-card").nth(3).waitFor();
      await p.evaluate(
        (t) => (document.documentElement.dataset.theme = t),
        theme,
      );
      const visible = await p
        .locator(".library-grid [data-play]")
        .evaluateAll((ns) => ns.map((n) => n.dataset.play));
      await p.locator(".library-grid [data-play]").nth(3).click();
      await p.waitForFunction(
        () =>
          document.querySelector("#audio").currentTime > 0.2 &&
          !document.querySelector("#audio").paused,
      );
      await openQueue();
      let list = await queueIds();
      assert.equal(list[0], visible[3]);
      assert.equal(list.length, 21);
      assert.deepEqual(list.slice(0, 5), visible.slice(3, 8));
      c.contextFirst = true;
      await p.screenshot({
        path: `captures/continuous-queue-${width}-${theme}.png`,
      });
      await p.locator("[data-close]").click();
      await p.evaluate((id) => (location.hash = "record/" + id), ids[0]);
      await p.locator("[data-play-next]").click();
      await openQueue();
      list = await queueIds();
      assert.equal(list[1], ids[0]);
      assert.equal(list.length, 22);
      await p.locator("[data-close]").click();
      await p.locator("#next").click();
      await p.waitForFunction(
        (id) =>
          document.querySelector("#player-title").getAttribute("href") ===
          "#record/" + id,
        ids[0],
      );
      await p.waitForFunction(
        () =>
          document.querySelector("#audio").currentTime > 0.2 &&
          !document.querySelector("#audio").paused,
      );
      c.manualPriority = true;
      await openQueue();
      list = await queueIds();
      const key = await p
        .locator(".queue-item.current")
        .getAttribute("data-queue-key");
      await p
        .locator(".queue-item")
        .nth(3)
        .locator("[data-queue-drag]")
        .press("ArrowUp");
      assert.equal(
        await p.locator(".queue-item.current").getAttribute("data-queue-key"),
        key,
      );
      c.reorderKeepsCurrent = true;
      await p.locator("#clear-queue").click();
      assert.equal((await queueIds()).length, 0);
      assert.equal(
        await p.locator("#autoplay-queue").getAttribute("aria-pressed"),
        "false",
      );
      await p.locator("[data-close]").click();
      await p.locator("#next").click();
      await openQueue();
      assert.equal((await queueIds()).length, 0);
      c.clearStopsRefill = true;
      await p.locator("[data-close]").click();
      await p.evaluate(() => (location.hash = "playlist/autoplay-test"));
      await p.locator("[data-play-personal]").click();
      await p.waitForFunction(
        () =>
          document.querySelector("#audio").currentTime > 0.2 &&
          !document.querySelector("#audio").paused,
      );
      await openQueue();
      assert.deepEqual(await queueIds(), [ids[1], ids[0], ids[1]]);
      await p.locator("#autoplay-queue").click();
      list = await queueIds();
      assert.deepEqual(list.slice(0, 3), [ids[1], ids[0], ids[1]]);
      assert.equal(list.length, 21);
      assert.equal(await p.locator(".queue-origin").count(), 18);
      c.playlistContinuationLabeled = true;
      await p.locator("#autoplay-queue").click();
      assert.deepEqual(await queueIds(), [ids[1], ids[0], ids[1]]);
      c.offRetainsExplicitDuplicates = true;
      await p.locator("#clear-queue").click();
      await p.locator("[data-close]").click();
      await p.evaluate((id) => (location.hash = "record/" + id), ids[0]);
      await p.locator("[data-queue]").click();
      await openQueue();
      assert.deepEqual(await queueIds(), [ids[0]]);
      assert.equal(await p.locator(".queue-item.current").count(), 0);
      await p.locator("[data-close]").click();
      await p.locator("#next").click();
      await p.waitForFunction(
        (id) =>
          document.querySelector("#player-title").getAttribute("href") ===
          "#record/" + id,
        ids[0],
      );
      await openQueue();
      assert.equal(
        await p
          .locator(".queue-item.current [data-play-record]")
          .getAttribute("data-play-record"),
        ids[0],
      );
      c.addAfterClearStartsFirstUpcoming = true;
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
    "data/continuous-queue-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
