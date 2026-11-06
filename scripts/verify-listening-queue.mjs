import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.BASE_URL || "http://127.0.0.1:4191";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
const breakdown = "recovered-sound-1-b2cb781aa0b35aec7acef3f9751b61505fd5715a";
const driving = "mint-songs-1-2b5426a5b98a3e366230eba9f95a24f09ae4a584-7";
const openQueue = async (width) => {
  await page.locator(width === 390 ? "#mobile-queue" : "#queue-now").click();
  await page.locator("#queue-dialog[open]").waitFor();
};
const closeQueue = () => page.locator("#queue-dialog [data-close]").click();
const rows = () =>
  page
    .locator("#queue-list [data-queue-play]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
const goRecord = async (id) => {
  await page.evaluate((id) => (location.hash = "#record/" + id), id);
  await page.locator(`.record-head [data-play="${id}"]`).waitFor();
};
const playing = async () => {
  await page.waitForFunction(
    () => {
      const a = document.querySelector("#audio");
      return !a.paused && a.currentTime > 0.3 && a.readyState >= 2;
    },
    null,
    { timeout: 60000 },
  );
};
const audioState = () =>
  page.locator("#audio").evaluate((a) => ({
    src: a.currentSrc,
    time: a.currentTime,
    paused: a.paused,
    duration: a.duration,
  }));
try {
  const catalog = (await (await page.request.get(base + "/api/catalog")).json())
    .records;
  const title = (id) => catalog.find((r) => r.id === id).title;
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + "/#explore");
      await page.locator(".filter-toolbar").waitFor();
      await page.evaluate(
        (t) => (document.documentElement.dataset.theme = t),
        theme,
      );
      await page.locator("#search").fill("pete rango");
      await page.locator(`[data-play="${breakdown}"]`).waitFor();
      const selection = await page
        .locator("main [data-play]")
        .evaluateAll((els) => [...new Set(els.map((e) => e.dataset.play))]);
      assert.ok(selection.length > 2);
      await page.locator(`[data-play="${breakdown}"]`).click();
      await openQueue(width);
      assert.deepEqual(
        await rows(),
        [
          ...selection.slice(selection.indexOf(breakdown)),
          ...selection.slice(0, selection.indexOf(breakdown)),
        ].map((id) => "Play " + title(id)),
      );
      assert.equal(
        await page.locator("#queue-context").innerText(),
        "Playing from your browsing selection",
      );
      await closeQueue();
      await page.locator("#next").click();
      await openQueue(width);
      assert.equal(
        await page.locator("#queue-context").innerText(),
        "Playing from your browsing selection",
      );
      assert.equal(
        await page
          .locator(".queue-item.current [data-queue-play]")
          .getAttribute("data-queue-play"),
        "1",
      );
      await page.locator("#clear-queue").click();
      await closeQueue();
      await goRecord(driving);
      await page.locator(`[data-queue="${driving}"]`).click();
      await goRecord(breakdown);
      await page.locator(`[data-play="${breakdown}"]`).click();
      await playing();
      await openQueue(width);
      assert.deepEqual(await rows(), [
        "Play " + title(breakdown),
        "Play " + title(driving),
      ]);
      assert.equal(
        await page.locator("#queue-context").innerText(),
        "Your listening order",
      );
      const beforeOther = await audioState();
      await page.locator('[data-queue-remove="1"]').click();
      assert.deepEqual(await rows(), ["Play " + title(breakdown)]);
      const afterOther = await audioState();
      assert.equal(afterOther.src, beforeOther.src);
      assert.equal(afterOther.paused, false);
      assert.ok(afterOther.time >= beforeOther.time);
      await closeQueue();
      await goRecord(driving);
      await page.locator(`[data-queue="${driving}"]`).click();
      await openQueue(width);
      await page.screenshot({ path: `captures/queue-${width}-${theme}.png` });
      assert.equal(
        await page
          .locator("#queue-dialog")
          .evaluate((e) => e.scrollWidth > e.clientWidth),
        false,
      );
      const beforeCurrent = await audioState();
      await page.locator('[data-queue-remove="0"]').click();
      assert.deepEqual(await rows(), ["Play " + title(driving)]);
      const afterCurrent = await audioState();
      assert.equal(afterCurrent.src, beforeCurrent.src);
      assert.equal(afterCurrent.paused, false);
      assert.ok(afterCurrent.time >= beforeCurrent.time);
      await closeQueue();
      await page.locator("#next").click();
      await page.waitForFunction(
        (t) => document.querySelector("#player-title").textContent === t,
        title(driving),
      );
      await playing();
      await openQueue(width);
      const beforeClear = await audioState();
      await page.locator("#clear-queue").click();
      assert.deepEqual(await rows(), []);
      assert.equal(await page.locator("#clear-queue").isDisabled(), true);
      const afterClear = await audioState();
      assert.equal(afterClear.src, beforeClear.src);
      assert.equal(afterClear.paused, false);
      assert.ok(afterClear.time >= beforeClear.time);
      await page.screenshot({
        path: `captures/queue-empty-${width}-${theme}.png`,
      });
      await closeQueue();
      await page.locator("#audio").evaluate((a) => {
        a.currentTime = a.duration - 0.25;
      });
      await page.waitForFunction(
        () => document.querySelector("#audio").ended,
        null,
        { timeout: 15000 },
      );
      assert.equal(
        await page.locator("#player-title").innerText(),
        title(driving),
      );
      await openQueue(width);
      assert.deepEqual(await rows(), []);
      await closeQueue();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      const result = {
        width,
        theme,
        autoQueue: true,
        nextPreservesAuto: true,
        manualSelectionPreserved: true,
        removeOtherContinues: true,
        removeCurrentContinues: true,
        nextAfterRemovedCurrent: true,
        clearContinues: true,
        noAutoNextAfterClear: true,
        overflow: false,
      };
      checks.push(result);
      console.log(JSON.stringify(result));
    }
  assert.deepEqual(errors, []);
  writeFileSync(
    "data/queue-ui-verification.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        base,
        passed: true,
        scope:
          "Real browser queue interactions and original-media playback for Breakdown and Driving. Media availability is external.",
        checks,
        errors,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser.close();
}
