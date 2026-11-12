import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import { createCatalogLoader } from "../src/catalog-bundle.mjs";
import { filterAndSortBpm, bpmTag } from "../src/bpm-filter.mjs";
const base = process.env.VERIFY_BASE_URL;
if (!base) throw Error("VERIFY_BASE_URL is required");
const prefix = process.env.VERIFY_OUTPUT_PREFIX || "bpm-filter";
assert.match(prefix, /^[a-z0-9-]+$/);
const records = createCatalogLoader()().records,
  report = {
    checkedAt: new Date().toISOString(),
    base,
    sourceCommit: process.env.RELEASE_SOURCE_COMMIT || null,
    checks: [],
    status: "running",
  };
mkdirSync("captures", { recursive: true });
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  page.setDefaultNavigationTimeout(60000);
  await page.goto(base + "/#explore", { waitUntil: "commit" });
  await page.locator("[data-facet=bpmMin]").waitFor({ timeout: 60000 });
  const assertVisibleBpms = async () => {
    const ids = await page
      .locator(".record-card h3 a")
      .evaluateAll((anchors) =>
        anchors.map((a) =>
          decodeURIComponent(a.getAttribute("href").split("/")[1]),
        ),
      );
    const expected = ids
      .map((id) => bpmTag(records.find((r) => r.id === id)))
      .filter(Boolean)
      .map((tag) => tag.text);
    assert.deepEqual(
      await page.locator(".card-bpm").allTextContents(),
      expected,
    );
  };
  const enter = async (field, value) => {
    await page.locator(`[data-facet=${field}]`).fill(value);
    await page.locator(`[data-facet=${field}]`).press("Enter");
  };
  for (const view of [
    { width: 1440, height: 1000, theme: "light" },
    { width: 1440, height: 1000, theme: "dark" },
    { width: 390, height: 844, theme: "light" },
    { width: 390, height: 844, theme: "dark" },
  ]) {
    await page.setViewportSize({ width: view.width, height: view.height });
    if (
      (await page.evaluate(() => document.documentElement.dataset.theme)) !==
      view.theme
    )
      await page.locator("#theme").click();
    if (await page.locator("[data-clear-filters]").count())
      await page.locator("[data-clear-filters]").click();
    await assertVisibleBpms();
    await page.locator("[data-facet=bpmMin]").fill("99");
    await page.locator("[data-facet=bpmMin]").press("Tab");
    assert.equal(
      await page.evaluate(() => document.activeElement.dataset.facet),
      "bpmMax",
    );
    await page.locator("[data-facet=bpmMin]").fill("100");
    await page.locator("[data-facet=bpmMax]").click();
    assert.equal(
      await page.evaluate(() => document.activeElement.dataset.facet),
      "bpmMax",
    );
    await enter("bpmMax", "120");
    await page.locator("[data-facet=sort]").selectOption("bpm-asc");
    const expected = filterAndSortBpm(records, {
      bpmMin: "100",
      bpmMax: "120",
      sort: "bpm-asc",
    });
    const ids = await page
      .locator(".record-card h3 a")
      .evaluateAll((a) =>
        a.map((x) => decodeURIComponent(x.getAttribute("href").split("/")[1])),
      );
    assert.deepEqual(
      ids,
      expected.slice(0, 40).map((r) => r.id),
    );
    assert.deepEqual(
      await page.locator(".card-bpm").allTextContents(),
      expected.slice(0, 40).map((r) => bpmTag(r).text),
    );
    assert.match(
      await page.locator("[data-bpm-note]").textContent(),
      /estimated/,
    );
    const computed = await page
      .locator("[data-facet=bpmMin]")
      .evaluate((e) => ({
        font: parseFloat(getComputedStyle(e).fontSize),
        value: e.value,
      }));
    if (view.width === 390) assert.ok(computed.font >= 16);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    );
    await page.locator(".explore-filter-toolbar").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `captures/${prefix}-${view.width}-${view.theme}.png`,
    });
    await page.locator("[data-facet=sort]").selectOption("bpm-desc");
    assert.deepEqual(
      await page
        .locator(".record-card h3 a")
        .evaluateAll((a) => a.map((x) => x.getAttribute("href").split("/")[1])),
      filterAndSortBpm(records, {
        bpmMin: "100",
        bpmMax: "120",
        sort: "bpm-desc",
      })
        .slice(0, 40)
        .map((r) => r.id),
    );
    await enter("bpmMin", "401");
    assert.equal(await page.locator("[data-facet=bpmMin]").inputValue(), "100");
    await enter("bpmMin", "130");
    assert.equal(await page.locator("[data-facet=bpmMin]").inputValue(), "120");
    assert.equal(await page.locator("[data-facet=bpmMax]").inputValue(), "130");
    await enter("bpmMin", "");
    assert.equal(await page.locator("[data-facet=bpmMin]").inputValue(), "");
    const saved = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("mn-archive-explore-filters-v1"))
          .values,
    );
    assert.equal(saved.bpmMax, "130");
    assert.equal(saved.sort, "bpm-desc");
    await page.locator("[data-clear-filters]").click();
    assert.equal(await page.locator("[data-facet=bpmMax]").inputValue(), "");
    await assertVisibleBpms();
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem("mn-archive-explore-filters-v1"),
      ),
      null,
    );
    report.checks.push({
      ...view,
      status: "passed",
      rangeCount: expected.length,
      fontSize: computed.font,
    });
  }
  await enter("bpmMin", "110");
  await enter("bpmMax", "125");
  await page.locator("[data-facet=sort]").selectOption("bpm-desc");
  await page.reload({ waitUntil: "commit" });
  await page.locator("[data-facet=bpmMin]").waitFor({ timeout: 60000 });
  assert.equal(await page.locator("[data-facet=bpmMin]").inputValue(), "110");
  assert.equal(await page.locator("[data-facet=bpmMax]").inputValue(), "125");
  assert.equal(
    await page.locator("[data-facet=sort]").inputValue(),
    "bpm-desc",
  );
  report.checks.push({ case: "actual-reload-persistence", status: "passed" });
  assert.deepEqual(errors, []);
  report.pageErrors = errors;
  report.status = "passed";
} catch (e) {
  report.status = "failed";
  report.error = e.stack;
  process.exitCode = 1;
} finally {
  await browser.close();
  writeFileSync(
    `data/${prefix}-ui-verification.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
