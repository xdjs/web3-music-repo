import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
const id = "recovered-sound-10-1bfc0624b52e870cc00d4e39995c75c7da8763d3";
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
const report = { checkedAt: new Date().toISOString(), id, errors };
try {
  await p.goto("http://127.0.0.1:4190/#record/" + id);
  await p.locator("main h1").waitFor();
  report.details = await p.locator("main").innerText();
  assert.match(report.details, /Jacob Grosse/);
  assert.match(report.details, /REMIXER|Remixer|remixer/);
  await p
    .locator('[data-play="' + id + '"]')
    .first()
    .click();
  await p.waitForFunction(
    () => document.querySelector("#audio").currentTime > 1,
    null,
    { timeout: 30000 },
  );
  report.playback = await p.locator("#audio").evaluate((a) => ({
    time: a.currentTime,
    duration: a.duration,
    readyState: a.readyState,
    source: a.currentSrc,
    error: a.error?.message || null,
    status: document.querySelector("#player-source").textContent,
  }));
  await p.locator("#audio").evaluate((a) => a.pause());
  await p.getByRole("tab", { name: "Provenance", exact: true }).click();
  await p
    .getByRole("heading", { name: "Follow the surviving record", exact: true })
    .waitFor();
  report.provenance = await p.locator("[role=tabpanel]").innerText();
  assert.match(report.provenance, /current metadata has empty audio fields/);
  assert.match(
    report.provenance,
    /hosted transcode recovered from an archived page/,
  );
  await p.screenshot({
    path: "captures/mija-archived-provenance.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  report.passed = true;
  console.log(JSON.stringify({ playback: report.playback, passed: true }));
} finally {
  fs.writeFileSync(
    "data/sound-resolution/mija-app-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  await b.close();
}
