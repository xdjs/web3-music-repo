import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const b = await chromium.launch({ headless: true }),
  p = await b.newPage(),
  errors = [];
p.on("pageerror", (e) => errors.push(e.message));
const checks = [];
try {
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      await p.setViewportSize({ width, height: 1000 });
      await p.goto("http://127.0.0.1:4190/#artist/pete-rango");
      await p
        .getByRole("heading", { name: "Pete Rango", exact: true })
        .waitFor();
      await p.evaluate(
        (t) => (document.documentElement.dataset.theme = t),
        theme,
      );
      await p.waitForTimeout(250);
      assert.equal(await p.locator(".record-card").count(), 11);
      assert.ok(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await p.screenshot({
        path: `captures/pete-complete-attribution-${width}-${theme}.png`,
      });
      checks.push({ width, theme, creditedRecords: 11, overflow: false });
    }
  await p.goto("http://127.0.0.1:4190/#explore");
  await p.locator("#search").fill("p3t3rango");
  await p.waitForTimeout(400);
  assert.equal(await p.locator(".record-card").count(), 11);
  await p.goto("http://127.0.0.1:4190/#artists");
  await p.locator("#artist-search").fill("p3t3rango");
  await p.waitForTimeout(300);
  assert.equal(await p.locator(".artist-card").count(), 1);
  assert.match(await p.locator(".artist-card").innerText(), /Pete Rango/);
  await p.goto("http://127.0.0.1:4190/#record/record-61048859");
  await p.getByRole("link", { name: "Credit source", exact: false }).waitFor();
  assert.match(
    await p.locator("[role=tabpanel]").innerText(),
    /Production & mixing/,
  );
  assert.deepEqual(errors, []);
  writeFileSync(
    "data/pete-alias-ui-verification.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        checks,
        aliasSearchMatches: 11,
        directoryProfiles: 1,
        creditSources: true,
        completeDiscography: false,
        errors,
      },
      null,
      2,
    ),
  );
  console.log("PETE ALIAS VERIFIED", JSON.stringify(checks));
} finally {
  await b.close();
}
