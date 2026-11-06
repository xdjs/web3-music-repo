import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
const base = process.env.ARCHIVE_QA_URL || "http://127.0.0.1:4191";
const bundle = JSON.parse(
  readFileSync("data/supercollector/recovered-media.json", "utf8"),
);
const mismatch = bundle.records.find(
  (r) => bundle.evidence[r.id]?.contractURIRead?.status === "mismatch",
);
const match = bundle.records.find(
  (r) =>
    bundle.evidence[r.id]?.contractURIRead?.status ===
      "template-matches-index" && r.musicMetadata.bpms.length,
);
assert.ok(mismatch && match);
const browser = await chromium.launch({ headless: true }),
  page = await browser.newPage(),
  errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript(
        (t) => localStorage.setItem("mn-archive-theme", t),
        theme,
      );
      await page.goto(base + `/?qa=super-${width}-${theme}#explore`);
      await page.locator('[data-filter="Supercollector"]').click();
      await page.waitForTimeout(100);
      assert.ok(await page.locator(".record-card").count());
      assert.ok(
        (await page.locator(".cover-badge").allTextContents()).every(
          (t) => t === "Supercollector",
        ),
      );
      await page.goto(base + "/#record/" + match.id);
      await page
        .getByRole("link", { name: "Official public release page" })
        .waitFor();
      assert.match(
        await page.locator(".music-facts").innerText(),
        /Official release metadata/,
      );
      await page.locator('[data-tab="proof"]').click();
      await page
        .locator('[data-contract-uri-status="template-matches-index"]')
        .waitFor();
      await page.goto(base + "/#record/" + mismatch.id + "?tab=proof");
      const notice = page.locator('[data-contract-uri-status="mismatch"]');
      await notice.waitFor();
      assert.match(
        await notice.innerText(),
        /not a verified current token metadata read/,
      );
      assert.match(await notice.innerText(), /159180072/);
      assert.equal(
        await notice.locator("code").innerText(),
        bundle.evidence[mismatch.id].contractURIRead.value,
      );
      await notice.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `captures/supercollector-provenance-${width}-${theme}.png`,
      });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      checks.push({
        width,
        theme,
        platformFilter: true,
        publicReleaseMetadataLabel: true,
        templateMatch: true,
        mismatchVisible: true,
        noOverflow: true,
      });
    }
  assert.deepEqual(errors, []);
  const result = {
    checkedAt: new Date().toISOString(),
    base,
    match: match.id,
    mismatch: mismatch.id,
    checks,
    errors,
  };
  writeFileSync(
    "data/supercollector/ui-verification.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
