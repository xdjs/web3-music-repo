import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.ARCHIVE_QA_URL || "http://127.0.0.1:4191";
const ids = [
  "recovered-sound-10-1bfc0624b52e870cc00d4e39995c75c7da8763d3",
  "record-not4me",
  "spinamp-94ba38fe64af02a6ebd6",
  "recovered-sound-10-1bfc0624b52e870cc00d4e39995c75c7da8763d3",
  "spinamp-c4fbf6953ce75fd2a410",
];
const browser = await chromium.launch({ headless: true }),
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const report = {
  base,
  checkedAt: new Date().toISOString(),
  checks: [],
  views: [],
  errors,
};
async function queueRows() {
  await page.locator("#show-queue").click();
  const rows = await page.locator(".queue-item").evaluateAll((nodes) =>
    nodes.map((n) => ({
      title: n.querySelector("div")?.childNodes[0]?.textContent,
      current: n.classList.contains("current"),
    })),
  );
  await page.locator("#queue-dialog [data-close]").click();
  return rows;
}
try {
  await page.goto(base + "/#explore");
  await page.locator(".record-card").first().waitFor({ timeout: 20000 });
  for (const id of ids) {
    await page.goto(base + "/#record/" + id);
    await page.locator('[data-queue="' + id + '"]').click();
  }
  const beforeRows = await queueRows();
  assert.equal(beforeRows.length, 5);
  await page.locator("#show-queue").click();
  await page.locator('[data-queue-play="0"]').click();
  await page.waitForFunction(
    () => document.querySelector("#audio").currentTime > 1,
    null,
    { timeout: 45000 },
  );
  await page.evaluate(() => {
    window.shuffleMediaEvents = [];
    for (const ev of ["emptied", "loadstart"])
      document
        .querySelector("#audio")
        .addEventListener(ev, () => window.shuffleMediaEvents.push(ev));
  });
  const before = await page
    .locator("#audio")
    .evaluate((a) => ({ src: a.currentSrc, time: a.currentTime }));
  await page.locator("#shuffle").click();
  await page.waitForTimeout(350);
  const after = await page.locator("#audio").evaluate((a) => ({
    src: a.currentSrc,
    time: a.currentTime,
    paused: a.paused,
    events: window.shuffleMediaEvents,
  }));
  assert.equal(
    await page.locator("#shuffle").getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(after.src, before.src);
  assert.ok(after.time > before.time);
  assert.equal(after.paused, false);
  assert.deepEqual(after.events, []);
  const shuffled = await queueRows();
  assert.equal(shuffled[0].title, beforeRows[0].title);
  assert.deepEqual(
    shuffled.map((x) => x.title).sort(),
    beforeRows.map((x) => x.title).sort(),
  );
  await page.locator("#shuffle").click();
  assert.deepEqual(
    await queueRows(),
    beforeRows.map((x, i) => ({ ...x, current: i === 0 })),
  );
  report.checks.push({
    name: "toggle preserves real playback, duplicates and restores upcoming order",
    before,
    after,
  });
  await page.locator("#shuffle").click();
  const ordered = await queueRows();
  await page.locator("#next").click();
  await page.waitForTimeout(150);
  const nextRows = await queueRows();
  assert.equal(nextRows[1].current, true);
  assert.deepEqual(
    nextRows.map((x) => x.title),
    ordered.map((x) => x.title),
  );
  await page.locator("#queue-now").click();
  await page.locator('[data-queue-remove="3"]').click();
  await page.locator("#queue-dialog [data-close]").click();
  await page.locator("#shuffle").click();
  assert.equal((await queueRows()).length, 4);
  report.checks.push({
    name: "Next walks existing shuffle and removed occurrence stays removed",
  });
  await page.goto(base + "/#record/" + ids[0]);
  await page
    .locator('[data-play="' + ids[0] + '"]')
    .first()
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector("#audio").currentTime > 0.5 &&
      !document.querySelector("#audio").paused,
    null,
    { timeout: 45000 },
  );
  await page.locator("#shuffle").click();
  await page.locator("#queue-now").click();
  const clearingTime = await page
    .locator("#audio")
    .evaluate((a) => a.currentTime);
  await page.locator("#clear-queue").click();
  assert.equal(await page.locator(".queue-item").count(), 0);
  await page.locator("#queue-dialog [data-close]").click();
  await page.waitForTimeout(350);
  assert.ok(
    await page
      .locator("#audio")
      .evaluate((a) => !a.paused && a.currentTime > 0),
  );
  assert.equal(
    await page.locator("#shuffle").getAttribute("aria-pressed"),
    "true",
  );
  report.checks.push({
    name: "clear retains current playback and shuffle preference",
    clearingTime,
  });
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 900 });
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await page.locator("#theme").click();
      await page.waitForTimeout(100);
      const bounds = await page
        .locator("#player .transport button")
        .evaluateAll((nodes) =>
          nodes
            .filter((n) => getComputedStyle(n).display !== "none")
            .map((n) => ({
              id: n.id,
              left: n.getBoundingClientRect().left,
              right: n.getBoundingClientRect().right,
              top: n.getBoundingClientRect().top,
              bottom: n.getBoundingClientRect().bottom,
            })),
        );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      assert.ok(bounds.every((b) => b.left >= 0 && b.right <= width));
      for (let i = 1; i < bounds.length; i++)
        assert.ok(bounds[i].left >= bounds[i - 1].right, "Controls overlap");
      await page.screenshot({ path: `captures/shuffle-${width}-${theme}.png` });
      report.views.push({ width, theme, bounds, noOverflow: true });
    }
  await page.setViewportSize({ width: 320, height: 800 });
  await page.waitForTimeout(250);
  report.smallViewportOverflow = await page
    .locator("body *")
    .evaluateAll((nodes) =>
      nodes
        .filter((n) => n.getBoundingClientRect().right > innerWidth + 1)
        .map((n) => ({
          tag: n.tagName,
          id: n.id,
          class: n.className,
          right: n.getBoundingClientRect().right,
        }))
        .slice(0, 15),
    );
  await page.screenshot({ path: "captures/shuffle-320.png" });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.ok((await page.locator("#shuffle").boundingBox()).x >= 0);
  report.checks.push({ name: "320px no horizontal overflow" });
  await page.reload();
  await page.locator(".record-head").waitFor();
  assert.equal(
    await page.locator("#shuffle").getAttribute("aria-pressed"),
    "true",
  );
  await page
    .locator('[data-play="' + ids[0] + '"]')
    .first()
    .click();
  await page.waitForFunction(
    () => document.querySelector("#audio").currentTime > 0.3,
    null,
    { timeout: 45000 },
  );
  await page.locator("#mobile-queue").click();
  assert.ok((await page.locator(".queue-item").count()) > 0);
  report.checks.push({
    name: "saved shuffle preference survives reload and next context",
  });
  assert.deepEqual(errors, []);
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.error = error.stack;
  throw error;
} finally {
  writeFileSync(
    "data/shuffle-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
