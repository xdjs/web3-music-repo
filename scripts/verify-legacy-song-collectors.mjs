import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const b = await chromium.launch({ headless: true }),
  p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
await p.goto(
  "http://127.0.0.1:4190/#record/recovered-legacy-29d8c82adba12c822c37090fc1cf7f430bbc1a60-1?tab=collectors",
  { waitUntil: "domcontentloaded" },
);
await p.locator(".collector-card").first().waitFor({ timeout: 45000 });
await p.locator(".collector-grid").scrollIntoViewIfNeeded();
await p.waitForTimeout(2000);
const result = await p.evaluate(() => ({
  cards: document.querySelectorAll(".collector-card").length,
  loadedAvatars: [...document.querySelectorAll(".collector-avatar img")].filter(
    (i) => i.complete && i.naturalWidth > 0,
  ).length,
  headerTextRemoved: !document
    .querySelector(".topbar")
    .textContent.includes("MUSIC, STILL HERE."),
}));
await p.screenshot({ path: "captures/too-close-collectors-current.png" });
console.log(result);
assert.ok(result.cards > 1);
assert.ok(result.loadedAvatars > 0);
writeFileSync(
  "data/song-collector-ui-verification.json",
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      record: "Daniel Allan / Too Close",
      ...result,
    },
    null,
    2,
  ),
);
await b.close();
