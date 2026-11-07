import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
const base = process.env.VERIFY_BASE_URL || "http://127.0.0.1:4191";
const audit = JSON.parse(readFileSync("data/metadata-enrichment-audit.json"));
const credit = audit.records.find((r) => r.addedCredits.length);
const cases = [
  {
    id: credit.recordId,
    text: credit.addedCredits[0],
    label: "credits",
    indexed: true,
  },
  {
    id: "spinamp-3b833c42f200be2359cc",
    text: "126 BPM",
    label: "source-bpm",
    indexed: true,
  },
  {
    id: "spinamp-52652b7e8c0c93fdc260",
    text: "BPM estimated by Open BPM",
    label: "estimate",
    indexed: false,
  },
];
const report = {
  checkedAt: new Date().toISOString(),
  base,
  scope:
    "Actual local catalog and existing song Details; no playback or audio-analysis accuracy claim",
  cases: [],
};
mkdirSync("captures", { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const view of [
    { width: 1440, height: 1000, theme: "dark" },
    { width: 390, height: 844, theme: "light" },
  ]) {
    const context = await browser.newContext({
      viewport: { width: view.width, height: view.height },
    });
    await context.addInitScript(
      (theme) => localStorage.setItem("mn-archive-theme", theme),
      view.theme,
    );
    const page = await context.newPage();
    for (const sample of cases) {
      await page.goto(`${base}/#record/${sample.id}?tab=about`, {
        waitUntil: "domcontentloaded",
      });
      await page
        .getByText(sample.text, { exact: false })
        .first()
        .waitFor({ timeout: 25000 });
      const content = await page.locator('[role="tabpanel"]').innerText();
      assert.ok(content.includes(sample.text));
      if (sample.indexed)
        assert.ok(content.includes("Spinamp indexed metadata"));
      if (sample.label === "estimate")
        assert.ok(content.includes("~178.3 BPM"));
      await page
        .getByText(sample.text, { exact: false })
        .first()
        .evaluate((el) => el.scrollIntoView({ block: "center" }));
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      );
      assert.equal(overflow, false);
      const screenshot = `captures/metadata-${sample.label}-${view.width}-${view.theme}.png`;
      await page.screenshot({ path: screenshot });
      report.cases.push({
        ...sample,
        viewport: view,
        screenshot,
        passed: true,
      });
    }
    await context.close();
  }
} finally {
  await browser.close();
  writeFileSync(
    "data/metadata-ui-verification.json",
    JSON.stringify(report, null, 2),
  );
}
console.log(JSON.stringify({ passed: report.cases.length }));
