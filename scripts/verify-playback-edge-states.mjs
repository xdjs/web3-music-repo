import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { encodePlaylistShare } from "../src/playlist-share.mjs";
const base = process.env.ARCHIVE_QA_URL || "http://127.0.0.1:4191";
const id = "recovered-sound-10-1bfc0624b52e870cc00d4e39995c75c7da8763d3";
const b = await chromium.launch({ headless: true });
const report = {
  checkedAt: new Date().toISOString(),
  base,
  checks: [],
  errors: [],
};
const p = await b.newPage();
p.setDefaultTimeout(20000);
p.on("pageerror", (e) => report.errors.push(e.message));
const details = await (await p.request.get(base + "/api/record/" + id)).json();
const original = details.record;
const ready = async (page, action) =>
  page.waitForFunction(
    ({ id, action }) =>
      document.querySelector(`[data-play="${id}"]`)?.dataset.playbackAction ===
      action,
    { id, action },
  );
try {
  await p.route("**/api/catalog?view=index", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.records.find((r) => r.id === id).recovery = { status: "pending" };
    await route.fulfill({ response, json: data });
  });
  await p.route("**/api/record/" + id, (route) =>
    route.fulfill({
      json: { record: { ...original, recovery: { status: "pending" } } },
    }),
  );
  let releaseRecovery;
  const delayed = new Promise((resolve) => (releaseRecovery = resolve));
  await p.route("**/api/recover/" + id, async (route) => {
    await delayed;
    await route.fulfill({ json: { ...original.recovery, status: "live" } });
  });
  await p.goto(base + "/#record/" + id);
  await ready(p, "play");
  await p.locator(`[data-play="${id}"]`).click();
  await ready(p, "pause");
  await p.locator('[data-now-action="back"]').click();
  await p.locator(`[data-play="${id}"]`).click();
  await ready(p, "play");
  releaseRecovery();
  await p.waitForTimeout(400);
  assert.equal(
    await p.locator("#audio").evaluate((a) => a.paused && a.currentTime === 0),
    true,
  );
  await p.locator(`[data-play="${id}"]`).click();
  await p.waitForFunction(
    () => document.querySelector("#audio").currentTime > 0.3,
    null,
    { timeout: 45000 },
  );
  report.checks.push(
    "Controlled delayed metadata can be paused; completing recovery does not autoplay; Play then starts the real recovered media",
  );
  await p.close();

  const q = await b.newPage();
  q.setDefaultTimeout(20000);
  q.on("pageerror", (e) => report.errors.push(e.message));
  await q.route("https://d2i9ybouka0ieh.cloudfront.net/**", (route) =>
    route.abort("failed"),
  );
  await q.goto(base + "/#record/" + id);
  await ready(q, "play");
  await q.locator(`[data-play="${id}"]`).click();
  await q.waitForFunction(() => document.querySelector("#audio").error);
  await ready(q, "play");
  assert.equal(
    await q.locator('[data-now="toggle"]').getAttribute("aria-label"),
    "Play",
  );
  await q.unroute("https://d2i9ybouka0ieh.cloudfront.net/**");
  await q.locator('[data-now="toggle"]').click();
  await q.waitForFunction(
    () => document.querySelector("#audio").currentTime > 0.3,
    null,
    { timeout: 45000 },
  );
  await ready(q, "pause");
  report.checks.push(
    "Actual media network failure resets every control to Play; retry after removing fault plays the original real source",
  );
  await q.locator('[data-now-action="back"]').click();
  const share = await encodePlaylistShare({
    name: "Shared controls QA",
    recordIds: [id],
  });
  await q.evaluate(
    (hash) => (location.hash = hash),
    "#shared-playlist/" + share,
  );
  await q.locator('[data-snapshot-index="0"]').waitFor();
  assert.equal(
    await q
      .locator('[data-snapshot-index="0"]')
      .getAttribute("data-playback-action"),
    "pause",
  );
  await q.locator('[data-snapshot-index="0"]').click();
  assert.equal(await q.locator("#audio").evaluate((a) => a.paused), true);
  report.checks.push(
    "Decoded shared playlist rows adopt live state and pause the shared player",
  );
  await q.evaluate(() => (location.hash = "#record/record-0e1581bc"));
  await q.locator(".original-release-notes").waitFor();
  const notes = await q.locator(".original-release-notes").innerText();
  assert.ok(notes.startsWith("The introduction of Bad Radio."));
  assert.ok(notes.includes("\n\n"));
  assert.equal(
    await q.getByText("Original release notes", { exact: true }).count(),
    0,
  );
  assert.equal(
    await q
      .locator('[role="tabpanel"]')
      .innerText()
      .then((s) => s.includes("An introduction")),
    false,
  );
  assert.equal(
    await q
      .locator(".original-release-notes")
      .evaluate((n) => getComputedStyle(n).whiteSpace),
    "pre-wrap",
  );
  await q.locator(".original-release-notes").scrollIntoViewIfNeeded();
  await q.waitForTimeout(3500);
  await q.screenshot({ path: "captures/original-release-notes-bad-radio.png" });
  report.checks.push(
    "Bad Radio original description is visible once with paragraph breaks; editorial introduction and collapsed duplicate are absent",
  );
  await q.close();
  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (e) {
  report.passed = false;
  report.error = e.stack;
  throw e;
} finally {
  writeFileSync(
    "data/playback-edge-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
  await b.close();
}
