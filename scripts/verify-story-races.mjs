import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.BASE_URL || "http://127.0.0.1:4191";
const id = "pete-zora-1-10d32bf55f5cbe66b068f2109ecf7475f0631d53-1";
const browser = await chromium.launch({ headless: true });
const report = {
  checkedAt: new Date().toISOString(),
  scope:
    "Story dialog race fixture with real module/native export and real Planet X playback, delayed older metadata response only is mocked.",
  checks: [],
  status: "running",
};
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/__story-race", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: '<!doctype html><link rel="stylesheet" href="/src/archive.css"><body></body>',
    }),
  );
  await page.goto(base + "/__story-race");
  await page.evaluate(async (id) => {
    const record = (await fetch("/api/record/" + id).then((r) => r.json()))
      .record;
    const { mountStoryExport } = await import("/src/story-export.mjs");
    // Public record artwork is read from its actual indexed recovery payload.
    const image = record.recovery.imageURL;
    window.__storyRace = mountStoryExport({
      getRecord: (id) =>
        id === "old-request"
          ? new Promise(
              (resolve) =>
                (window.__resolveOld = () =>
                  resolve({
                    ...record,
                    id: "old-request",
                    title: "Stale old request",
                  })),
            )
          : Promise.resolve(record),
      artworkURL: () => image,
    });
    window.__storyRace.open("old-request");
  }, id);
  await page.evaluate((id) => window.__storyRace.open(id), id);
  await page.waitForFunction(
    () => !document.querySelector("[data-story-render]").disabled,
    null,
    { timeout: 60000 },
  );
  await page.evaluate(() => window.__resolveOld());
  await page.locator(".story-exact summary").click();
  await page.locator("[data-story-start]").fill("100");
  await page.locator("[data-story-start]").dispatchEvent("change");
  await page.locator("[data-story-render]").click();
  await page.waitForFunction(
    () =>
      document
        .querySelector("[data-story-status]")
        .textContent.startsWith("MP4 ready"),
    null,
    { timeout: 35000 },
  );
  const manifest = JSON.parse(
    decodeURIComponent(
      (await page.locator("[data-story-manifest]").getAttribute("href"))
        .split(",")
        .slice(1)
        .join(","),
    ),
  );
  assert.equal(manifest.recordId, id);
  assert.equal(manifest.title, "Planet X");
  report.checks.push(
    "Late previous record metadata cannot overwrite the current export manifest or title",
  );
  await page.locator("[data-story-render]").click();
  await page.waitForTimeout(500);
  await page.locator("[data-story-close]").click();
  await page.evaluate((id) => window.__storyRace.open(id), id);
  await page.waitForFunction(
    () => !document.querySelector("[data-story-render]").disabled,
    null,
    { timeout: 60000 },
  );
  assert.match(
    await page.locator("[data-story-status]").innerText(),
    /Choose your excerpt/,
  );
  report.checks.push(
    "Closing an active export aborts it; its completion does not replace newly opened dialog status",
  );
  assert.deepEqual(errors, []);
  report.errors = errors;
  report.status = "passed";
} catch (e) {
  report.status = "failed";
  report.error = e.stack;
  throw e;
} finally {
  writeFileSync(
    "data/story-race-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(report);
  await browser.close();
}
