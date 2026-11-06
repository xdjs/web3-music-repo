import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const base = process.env.VERIFY_BASE_URL || "http://127.0.0.1:4191",
  copies = JSON.parse(
    readFileSync("data/spinamp/playback-copies.json"),
  ).records;
const b = await chromium.launch(),
  receipt = { checkedAt: new Date().toISOString(), base, records: [] };
try {
  for (const [id, c] of Object.entries(copies)) {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`${base}/#record/${id}?tab=proof`);
    await p.locator('[data-playback-copy="spinamp-preserved-audio"]').waitFor();
    assert.equal(
      await p.locator("[data-playback-copy] a").getAttribute("href"),
      c.verification.url,
    );
    const proof = await p.locator(".provenance").innerText();
    assert.ok(proof.includes(c.originalMediaURI));
    assert.match(proof, /Original media/);
    await p.locator(`.record-head [data-play="${id}"]`).click();
    await p.waitForFunction(
      () => {
        const a = document.querySelector("#audio");
        return a.currentTime > 1 && !a.paused;
      },
      null,
      { timeout: 22000 },
    );
    const audio = await p.locator("#audio").evaluate((a) => ({
      url: a.currentSrc,
      time: a.currentTime,
      duration: a.duration,
      readyState: a.readyState,
      paused: a.paused,
    }));
    assert.equal(audio.url, c.verification.url);
    await p.locator("#audio").evaluate((a) => a.pause());
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await p
      .locator("[data-playback-copy]")
      .screenshot({ path: `captures/preserved-playback-copy-${id}.png` });
    assert.deepEqual(errors, []);
    receipt.records.push({
      id,
      status: "played",
      ...audio,
      originalMediaPresent: true,
      copyNoticePresent: true,
    });
    await p.close();
  }
  writeFileSync(
    "data/spinamp/playback-copy-app-verification.json",
    JSON.stringify(receipt, null, 2) + "\n",
  );
  console.log(JSON.stringify(receipt));
} finally {
  await b.close();
}
