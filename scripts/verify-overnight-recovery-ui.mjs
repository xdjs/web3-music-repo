import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
const base = process.env.VERIFY_BASE_URL || "http://127.0.0.1:4301";
const full = JSON.parse(readFileSync("dist/catalog/full.json"));
const index = JSON.parse(readFileSync("dist/catalog/index.json"));
const analyses = JSON.parse(readFileSync("data/audio-analysis.json")).records;
const coverage = JSON.parse(readFileSync("data/bpm-coverage-report.json"));
const enrichment = JSON.parse(readFileSync("data/enrichment-report.json"));
let lyric;
for (const file of readdirSync("data/metadata-enrichment-batches")) {
  const batch = JSON.parse(
    readFileSync("data/metadata-enrichment-batches/" + file),
  );
  if (batch.campaignId !== "source-metadata-2026-11-07") continue;
  lyric = batch.records.find((r) => r.addedLyrics > 0);
  if (lyric) break;
}
const cases = ["Sound", "Catalog"].map((platform) => {
  const r = index.records
    .filter(
      (r) =>
        r.platform === platform &&
        r.musicFacts?.source.startsWith("BPM estimated"),
    )
    .sort((a, b) =>
      String(analyses[b.id]?.checkedAt || "").localeCompare(
        String(analyses[a.id]?.checkedAt || ""),
      ),
    )[0];
  assert.ok(r, "Estimated sample for " + platform);
  return {
    id: r.id,
    label: platform.toLowerCase() + "-estimate",
    text: `~${r.musicFacts.bpm} BPM`,
    estimate: true,
  };
});
cases.push({
  id: "spinamp-52a35c24083c4ee53030",
  label: "title-bpm-precedence",
  text: "145 BPM",
  estimate: false,
});
const supplied = index.records.find(
  (r) =>
    r.platform === "Sound" &&
    r.musicFacts?.bpm &&
    !r.musicFacts.source.startsWith("BPM estimated"),
);
cases.push({
  id: supplied.id,
  label: "source-bpm",
  text: `${supplied.musicFacts.bpm} BPM`,
  estimate: false,
});
assert.ok(lyric);
const lyricRecord = full.records.find((r) => r.id === lyric.recordId);
cases.push({
  id: lyric.recordId,
  label: "new-lyrics",
  text: lyricRecord.musicMetadata.lyrics[0].text.split("\n")[0],
  lyrics: true,
});
const report = {
  checkedAt: new Date().toISOString(),
  base,
  scope:
    "Actual catalog/UI of frozen overnight checkpoint; supplied metadata and Open BPM estimates remain distinguished. Representative views only, no playback/tempo-accuracy claim.",
  checks: [],
  status: "running",
};
const browser = await chromium.launch({ headless: true });
try {
  const api = await browser.newContext();
  const response = await api.request.get(base + "/api/catalog?view=index", {
    timeout: 60000,
  });
  assert.equal(response.status(), 200);
  const payload = await response.json();
  const estimated = payload.records.filter(
    (r) => r.musicFacts?.bpm && r.musicFacts.source.startsWith("BPM estimated"),
  ).length;
  const withBpm = payload.records.filter((r) => r.musicFacts?.bpm).length;
  const sound = payload.records.filter((r) => r.platform === "Sound");
  report.counts = {
    records: payload.records.length,
    withBpm,
    estimated,
    supplied: withBpm - estimated,
    soundWithBpm: sound.filter((r) => r.musicFacts?.bpm).length,
    soundRecords: sound.length,
  };
  assert.deepEqual(report.counts, {
    records: coverage.total.recordings,
    withBpm: coverage.total.withBpm,
    estimated: coverage.total.estimated,
    supplied: coverage.total.supplied,
    soundWithBpm: coverage.byPlatform.Sound.withBpm,
    soundRecords: coverage.byPlatform.Sound.recordings,
  });
  await api.close();
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
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const sample of cases) {
      await page.goto(base + "/#record/" + sample.id + "?tab=about", {
        waitUntil: "domcontentloaded",
      });
      if (sample.lyrics) {
        const section = page.locator("[data-lyrics]").first();
        await section.waitFor({ timeout: 45000 });
        await section.locator("summary").click();
        assert.ok(
          (
            await section.locator(".lyrics-panel .original-lyrics").innerText()
          ).includes(sample.text),
        );
        assert.ok(
          (await section.innerText()).includes("Lyrics indexed by Spinamp"),
        );
        await section.locator("h2").scrollIntoViewIfNeeded();
      } else {
        const facts = page.locator(".music-facts").first();
        await facts.waitFor({ timeout: 45000 });
        const text = await facts.innerText();
        assert.ok(text.includes(sample.text));
        if (sample.estimate)
          assert.ok(text.includes("BPM estimated by Open BPM"));
        else assert.ok(!text.includes("BPM estimated"));
        await facts.evaluate((el) => el.scrollIntoView({ block: "center" }));
      }
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
      );
      const capture = `captures/overnight-${sample.label}-${view.width}-${view.theme}.png`;
      await page.screenshot({ path: capture });
      report.checks.push({ ...sample, view, capture, passed: true });
    }
    report.checks.push({ view, pageErrors: errors });
    assert.deepEqual(errors, []);
    await context.close();
  }
  report.lyricsTrackCount = enrichment.lyricsTracks;
  report.status = "passed";
} catch (e) {
  report.status = "failed";
  report.error = e.stack;
  throw e;
} finally {
  await browser.close();
  writeFileSync(
    "data/overnight-recovery-ui-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(report);
}
