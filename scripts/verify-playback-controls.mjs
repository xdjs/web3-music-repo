import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.ARCHIVE_QA_URL || "http://127.0.0.1:4191";
const id = "recovered-sound-10-1bfc0624b52e870cc00d4e39995c75c7da8763d3";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(20000);
const report = {
  checkedAt: new Date().toISOString(),
  base,
  checks: [],
  views: [],
  errors: [],
};
page.on("pageerror", (e) => report.errors.push(e.message));
await page.addInitScript(
  ({ id }) => {
    localStorage.setItem(
      "mn-archive-playlists-v1",
      JSON.stringify([
        {
          id: "playback-qa",
          name: "Playback controls QA",
          recordIds: [id, "record-not4me", id],
          createdAt: new Date().toISOString(),
        },
      ]),
    );
    localStorage.setItem("mn-archive-likes", JSON.stringify([id]));
  },
  { id },
);
const np = page.locator("#now-playing-dialog");
const control = () => page.locator(`[data-play="${id}"]`).first();
const state = () =>
  page.locator("#audio").evaluate((a) => ({
    time: a.currentTime,
    src: a.currentSrc,
    paused: a.paused,
    events: window.controlMediaEvents || [],
  }));
const waitPlaying = () =>
  page.waitForFunction(
    () =>
      document.querySelector("#audio").currentTime > 0.6 &&
      !document.querySelector("#audio").paused,
    null,
    { timeout: 45000 },
  );
async function back() {
  await np.locator('[data-now-action="back"]').click();
  await page.waitForFunction(
    () => !document.querySelector("#now-playing-dialog").open,
  );
}
async function go(hash) {
  await page.evaluate((hash) => (location.hash = hash), hash);
  await page.waitForTimeout(180);
}
async function action(button, value) {
  await button.waitFor();
  await page.waitForFunction(
    ({ selector, value }) =>
      document.querySelector(selector)?.dataset.playbackAction === value,
    {
      selector: await button.evaluate((n) => {
        n.id ||= "control-qa-" + Math.random().toString(36).slice(2);
        return "#" + n.id;
      }),
      value,
    },
  );
}
try {
  await page.goto(`${base}/#record/${id}`);
  await action(control(), "play");
  await page.evaluate(() => {
    window.originalMain = document.querySelector("main").firstElementChild;
    window.scrollTo(0, 180);
  });
  await control().scrollIntoViewIfNeeded();
  const originalY = await page.evaluate(() => scrollY);
  await control().click();
  assert.equal(await np.evaluate((n) => n.open), true);
  await waitPlaying();
  for (let i = 0; i < 18; i++) {
    await page.keyboard.press("Tab");
    assert.equal(
      await np.evaluate((n) => n.contains(document.activeElement)),
      true,
    );
  }
  await page.evaluate(() => {
    window.controlMediaEvents = [];
    for (const e of ["emptied", "loadstart"])
      document
        .querySelector("#audio")
        .addEventListener(e, () => window.controlMediaEvents.push(e));
  });
  const before = await state();
  await back();
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelector("main").firstElementChild ===
        window.originalMain,
    ),
    true,
  );
  assert.equal(await page.evaluate(() => scrollY), originalY);
  assert.equal(
    await control().evaluate((n) => n === document.activeElement),
    true,
  );
  await action(control(), "pause");
  await control().click();
  assert.equal(await np.evaluate((n) => n.open), false);
  assert.equal((await state()).paused, true);
  await action(control(), "play");
  const stopped = await state();
  await page.waitForTimeout(180);
  assert.equal((await state()).time, stopped.time);
  await control().click();
  assert.equal(await np.evaluate((n) => n.open), true);
  await page.waitForTimeout(300);
  const resumed = await state();
  assert.ok(resumed.time > before.time);
  assert.equal(resumed.src, before.src);
  assert.deepEqual(resumed.events, []);
  report.continuity = { before, stopped, resumed };
  report.checks.push(
    "Song Play opens Now Playing; Back retains mounted page and scroll; Pause stays on page; Play resumes same source/time and opens player",
  );

  for (const width of [1440, 390, 320])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({
        width,
        height: width === 1440 ? 1000 : 844,
      });
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      await page.waitForTimeout(120);
      assert.ok(await np.evaluate((n) => n.scrollWidth <= n.clientWidth));
      await page.waitForFunction(
        () => {
          const n = document.querySelector('[data-now="art"]');
          return n.complete && n.naturalWidth > 0;
        },
        null,
        { timeout: 20000 },
      );
      await page.screenshot({
        path: `captures/now-playing-${width}-${theme}.png`,
      });
      report.views.push({ width, theme, noOverflow: true });
    }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.keyboard.press("Escape");
  assert.equal(await np.evaluate((n) => n.open), false);
  await go("#liked");
  await action(control(), "pause");
  await control().click();
  await action(control(), "play");
  await page.locator("#toggle").click();
  await action(control(), "pause");
  assert.equal(await np.evaluate((n) => n.open), false);
  await go("#record/" + id);
  const artist = await page
    .locator('.record-head a[href^="#artist/"]')
    .getAttribute("href");
  await go(artist);
  assert.ok((await page.locator(".record-card").count()) <= 40);
  for (
    let i = 0;
    i < 20 &&
    !(await control().count()) &&
    (await page.locator("[data-more-artist-records]").count());
    i++
  )
    await page.locator("[data-more-artist-records]").click();
  await action(control(), "pause");
  await control().click();
  await action(control(), "play");
  await page.locator("#toggle").click();
  await action(control(), "pause");
  await page.locator("#search").fill("Groove (Jacob Grosse Remix)");
  await page.waitForTimeout(350);
  await action(control(), "pause");
  await control().click();
  await action(control(), "play");
  await control().click();
  await waitPlaying();
  await back();
  report.checks.push(
    "Liked, artist and Explore/search cards synchronize through rerenders and both page/transport pause-resume",
  );

  await go("#playlist/playback-qa");
  const row = page.locator('[data-personal-track][data-index="0"]');
  await action(row, "pause");
  await row.click();
  await action(row, "play");
  await row.click();
  await waitPlaying();
  await back();
  await action(page.locator('[data-personal-track][data-index="2"]'), "pause");
  await page.locator("#open-now-playing").click();
  assert.equal(await np.evaluate((n) => n.open), true);
  await np.locator('[data-now-action="queue"]').click();
  assert.equal(
    await page.locator("#queue-dialog").evaluate((n) => n.open),
    true,
  );
  await page.locator("#queue-dialog [data-close]").click();
  await back();
  await page.locator("#player-title").click();
  assert.equal(await np.evaluate((n) => n.open), true);
  await back();
  report.checks.push(
    "Personal playlist duplicate rows share recording state; bottom artwork/title open player; queue stacks and closes independently",
  );

  // Build a duplicate queue with the real currently playing source.
  await go("#record/" + id);
  await page.locator("#queue-now").click();
  await page.locator("#clear-queue").click();
  await page.locator("#queue-dialog [data-close]").click();
  await page.locator(`[data-queue="${id}"]`).click();
  await page.locator(`[data-queue="${id}"]`).click();
  await page.locator("#queue-now").click();
  await page.locator('[data-queue-play="0"]').click();
  await waitPlaying();
  await back();
  await page.locator("#queue-now").click();
  await action(page.locator('[data-queue-play="0"]'), "pause");
  await action(page.locator('[data-queue-play="1"]'), "play");
  await page.locator("#queue-dialog [data-close]").click();
  await page.locator("#next").click();
  await waitPlaying();
  assert.equal(await np.evaluate((n) => n.open), false);
  await page.locator("#queue-now").click();
  await action(page.locator('[data-queue-play="1"]'), "pause");
  await page.locator("#queue-dialog [data-close]").click();
  await page.locator("#player-title").click();
  await np.locator('[data-now-action="previous"]').click();
  await waitPlaying();
  await page.locator("#audio").evaluate((a) => {
    a.currentTime = a.duration - 0.15;
  });
  await page.waitForFunction(
    () => document.querySelector("#audio").currentTime < 2,
    null,
    { timeout: 10000 },
  );
  assert.equal(await np.evaluate((n) => n.open), true);
  report.checks.push(
    "Duplicate queue occurrences stay distinct; Next after Back stays closed; automatic ended advance updates the open player",
  );
  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (e) {
  report.passed = false;
  report.error = e.stack;
  throw e;
} finally {
  writeFileSync(
    "data/playback-controls-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
