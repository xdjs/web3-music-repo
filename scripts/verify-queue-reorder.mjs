import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.ARCHIVE_QA_URL || "http://127.0.0.1:4191";
const mija = "recovered-sound-10-1bfc0624b52e870cc00d4e39995c75c7da8763d3",
  ids = [
    mija,
    "record-not4me",
    "spinamp-94ba38fe64af02a6ebd6",
    mija,
    "spinamp-c4fbf6953ce75fd2a410",
  ];
const browser = await chromium.launch({ headless: true }),
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
  errors = [],
  report = {
    checkedAt: new Date().toISOString(),
    base,
    checks: [],
    views: [],
    errors,
  };
const watch = (p) => p.on("pageerror", (e) => errors.push(e.message));
watch(page);
const rows = (p) =>
  p.locator("#queue-list .queue-item").evaluateAll((nodes) =>
    nodes.map((n) => ({
      key: n.dataset.queueKey,
      current: n.classList.contains("current"),
      title: n.querySelector("div").childNodes[0].textContent,
    })),
  );
const keys = (rs) => rs.map((r) => r.key);
async function drag(p, from, to) {
  const handles = p.locator("[data-queue-drag]"),
    a = await handles.nth(from).boundingBox(),
    b = await p.locator(".queue-item").nth(to).boundingBox();
  await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await p.mouse.down();
  await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + 9, { steps: 2 });
  await p.mouse.move(
    a.x + a.width / 2,
    to > from ? b.y + b.height - 3 : b.y + 3,
    { steps: 10 },
  );
  assert.ok(
    (await p.locator(".queue-drop-before,.queue-drop-after").count()) > 0,
  );
  await p.mouse.up();
}
async function media(p) {
  return p.locator("#audio").evaluate((a) => ({
    src: a.currentSrc,
    time: a.currentTime,
    paused: a.paused,
    events: window.reorderMediaEvents || [],
  }));
}
async function screenshot(p, width, theme) {
  await p.setViewportSize({ width, height: 1000 });
  if ((await p.locator("html").getAttribute("data-theme")) !== theme) {
    await p.locator("#queue-dialog [data-close]").click();
    await p.locator("#theme").click();
    await p.locator(width < 800 ? "#mobile-queue" : "#queue-now").click();
  }
  await p.waitForTimeout(100);
  assert.ok(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  const fit = await p
    .locator("#queue-list")
    .evaluate((n) => n.scrollWidth <= n.clientWidth);
  assert.ok(fit);
  await p.screenshot({ path: `captures/queue-reorder-${width}-${theme}.png` });
  report.views.push({ width, theme, noOverflow: true });
}
try {
  await page.goto(base + "/#explore");
  await page.locator(".record-card").first().waitFor({ timeout: 20000 });
  for (const id of ids) {
    await page.goto(base + "/#record/" + id);
    await page.locator('[data-queue="' + id + '"]').click();
  }
  await page.locator("#show-queue").click();
  await page.locator('[data-queue-play="0"]').click();
  await page.waitForFunction(
    () => document.querySelector("#audio").currentTime > 1,
    null,
    { timeout: 45000 },
  );
  await page.evaluate(() => {
    window.reorderMediaEvents = [];
    for (const ev of ["emptied", "loadstart"])
      document
        .querySelector("#audio")
        .addEventListener(ev, () => window.reorderMediaEvents.push(ev));
  });
  await page.locator("#shuffle").click();
  await page.locator("#queue-now").click();
  const original = await rows(page);
  const keyCurrent = original[0].key;
  await page.locator("[data-queue-drag]").nth(2).click();
  assert.deepEqual(keys(await rows(page)), keys(original));
  await drag(page, 4, 1);
  const dragged = await rows(page),
    expected = [...keys(original)];
  expected.splice(1, 0, expected.splice(4, 1)[0]);
  assert.deepEqual(keys(dragged), expected);
  await page.locator("#queue-dialog [data-close]").click();
  await page.locator("#shuffle").click();
  await page.locator("#queue-now").click();
  assert.deepEqual(keys(await rows(page)), expected);
  report.checks.push(
    "Explicit drag survives disabling shuffle; handle tap does not play",
  );
  const before = await media(page);
  await drag(page, 0, 2);
  await page.waitForTimeout(250);
  const moved = await rows(page),
    after = await media(page);
  assert.equal(moved[2].key, keyCurrent);
  assert.equal(moved[2].current, true);
  assert.equal(after.src, before.src);
  assert.ok(after.time > before.time);
  assert.equal(after.paused, false);
  assert.deepEqual(after.events, []);
  report.playhead = { before, after };
  await page
    .locator(`[data-queue-key="${keyCurrent}"] [data-queue-drag]`)
    .press("ArrowUp");
  const keyboard = await rows(page);
  assert.equal(keyboard[1].key, keyCurrent);
  assert.equal(keyboard[1].current, true);
  assert.equal(
    await page.locator(":focus").getAttribute("data-queue-drag"),
    "",
  );
  assert.equal(new Set(keys(keyboard)).size, 5);
  report.checks.push(
    "Mouse and keyboard moving current duplicate preserve exact occurrence and real audio",
  );
  const nextKey = keyboard[2].key;
  await page.locator("#queue-dialog [data-close]").click();
  await page.locator("#next").click();
  await page.locator("#queue-now").click();
  assert.equal((await rows(page)).find((r) => r.current)?.key, nextKey);
  report.checks.push("Next follows manually reordered occurrence");
  await screenshot(page, 1440, "light");
  await screenshot(page, 1440, "dark");
  const touchContext = await browser.newContext({
      viewport: { width: 390, height: 1000 },
      hasTouch: true,
      isMobile: true,
    }),
    touch = await touchContext.newPage();
  watch(touch);
  await touch.goto(base + "/#record/" + mija);
  await touch
    .locator('[data-play="' + mija + '"]')
    .first()
    .click();
  await touch.waitForFunction(
    () => document.querySelector("#audio").currentTime > 0.5,
    null,
    { timeout: 45000 },
  );
  await touch.locator("#mobile-queue").click();
  await touch.locator("#clear-queue").click();
  await touch.locator("#queue-dialog [data-close]").click();
  for (let i = 0; i < 12; i++)
    await touch.locator('[data-queue="' + mija + '"]').click();
  await touch.locator("#mobile-queue").click();
  const cdp = await touchContext.newCDPSession(touch);
  const first = await touch.locator("[data-queue-drag]").first().boundingBox(),
    third = await touch.locator(".queue-item").nth(2).boundingBox();
  const beforeTouch = await rows(touch),
    touchSource = await media(touch);
  const x = first.x + first.width / 2,
    y = first.y + first.height / 2,
    target = third.y + third.height - 3;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  for (let i = 1; i <= 8; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: y + ((target - y) * i) / 8 }],
    });
  assert.ok(
    (await touch.locator(".queue-drop-before,.queue-drop-after").count()) > 0,
  );
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  const afterTouch = await rows(touch);
  assert.equal(afterTouch[2].key, beforeTouch[0].key);
  assert.equal(new Set(keys(afterTouch)).size, 12);
  assert.equal((await media(touch)).src, touchSource.src);
  report.checks.push(
    "Native touch drag reorders duplicate occurrences without switching playback",
  );
  const dialog = touch.locator("#queue-dialog"),
    db = await dialog.boundingBox(),
    startScroll = await dialog.evaluate((n) => n.scrollTop),
    sx = db.x + db.width * 0.65,
    sy = db.y + db.height * 0.7;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: sx, y: sy }],
  });
  for (let i = 1; i <= 8; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: sx, y: sy - (170 * i) / 8 }],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await touch.waitForTimeout(250);
  assert.ok((await dialog.evaluate((n) => n.scrollTop)) > startScroll);
  report.checks.push("Touch scrolling outside handle remains native");
  await touch.locator("#queue-dialog [data-close]").click();
  await touch.locator("#mobile-queue").click();
  await dialog.evaluate((n) => (n.scrollTop = 0));
  report.mobileImages = await touch
    .locator(".queue-item img")
    .evaluateAll((nodes) =>
      nodes.slice(0, 2).map((n) => ({
        src: n.getAttribute("src"),
        width: n.naturalWidth,
        display: getComputedStyle(n).display,
      })),
    );
  await screenshot(touch, 390, "light");
  await screenshot(touch, 390, "dark");
  const beforeAdvance = keys(await rows(touch));
  const draggingHandle = await touch
    .locator("[data-queue-drag]")
    .first()
    .boundingBox();
  const draggingDialog = await dialog.boundingBox();
  const dragX = draggingHandle.x + draggingHandle.width / 2;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: dragX, y: draggingHandle.y + draggingHandle.height / 2 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: dragX, y: draggingDialog.y + draggingDialog.height - 5 },
    ],
  });
  assert.equal(await touch.locator(".queue-dragging").count(), 1);
  await touch.locator("#audio").evaluate((audio) => {
    window.queueNativeEnded = 0;
    audio.addEventListener("ended", () => window.queueNativeEnded++);
    audio.currentTime = audio.duration - 0.25;
  });
  await touch.waitForFunction(
    () =>
      window.queueNativeEnded > 0 &&
      document.querySelector(".queue-item.current"),
    null,
    { timeout: 15000 },
  );
  assert.equal(
    (await rows(touch)).find((row) => row.current)?.key,
    beforeAdvance[0],
  );
  assert.equal(
    await touch
      .locator(".queue-dragging,.queue-drop-before,.queue-drop-after")
      .count(),
    0,
  );
  const stoppedScroll = await dialog.evaluate((n) => n.scrollTop);
  await touch.waitForTimeout(250);
  assert.equal(await dialog.evaluate((n) => n.scrollTop), stoppedScroll);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  assert.deepEqual(keys(await rows(touch)), beforeAdvance);
  report.checks.push(
    "Real ended advance refreshes open queue and cancels active drag/autoscroll without committing it",
  );
  await touchContext.close();
  assert.deepEqual(errors, []);
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.error = error.stack;
  throw error;
} finally {
  writeFileSync(
    "data/queue-reorder-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
