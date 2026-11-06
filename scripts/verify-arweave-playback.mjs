import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { createCatalogLoader } from "../src/catalog-bundle.mjs";
const base = process.env.ARCHIVE_QA_URL || "http://127.0.0.1:4191";
const bundle = createCatalogLoader()();
const ids = [
  "recovered-sound-10-145ac4d1ad5817b28997a479a980ea1d5d53e3e9",
  "recovered-sound-10-191fc84c0dd16a5f7aa333c39021227a91cc44a3",
  "record-61048859",
];
const selectedIds = process.env.ARWEAVE_QA_IDS
  ? ids.filter((id) => process.env.ARWEAVE_QA_IDS.split(",").includes(id))
  : ids;
const browser = await chromium.launch({ headless: true });
const report = {
  checkedAt: new Date().toISOString(),
  base,
  scope:
    "Three user-reported tracks, real player startup/advancement after finite same-transaction Arweave fallback; no whole-track playback claim.",
  records: [],
};
let index = 0;
try {
  await Promise.all(
    Array.from({ length: 2 }, async () => {
      while (index < selectedIds.length) {
        const id = selectedIds[index++],
          record = bundle.records.find((r) => r.id === id),
          original = bundle.evidence[id]?.mediaURL;
        const page = await browser.newPage();
        const responses = [],
          failures = [];
        page.on("response", async (r) => {
          if (/arweave\.net|turbo-gateway\.com/.test(r.url())) {
            const h = await r.allHeaders().catch(() => ({}));
            responses.push({
              url: r.url(),
              status: r.status(),
              mime: h["content-type"],
              contentRange: h["content-range"],
              length: h["content-length"],
            });
          }
        });
        page.on("requestfailed", (r) => {
          if (/arweave\.net|turbo-gateway\.com/.test(r.url()))
            failures.push({ url: r.url(), error: r.failure()?.errorText });
        });
        let result;
        const start = Date.now();
        try {
          await page.goto(base + "/#record/" + id);
          await page.locator(`[data-play="${id}"]`).first().click();
          await page.waitForFunction(
            () => {
              const m = document.querySelector("#audio");
              return m && m.currentTime > 0.5 && !m.paused && m.readyState >= 2;
            },
            null,
            { timeout: 65000 },
          );
          const before = await page
            .locator("#audio")
            .evaluate((m) => m.currentTime);
          await page.waitForFunction(
            (before) =>
              document.querySelector("#audio").currentTime > before + 1,
            before,
            { timeout: 20000 },
          );
          const media = await page.locator("#audio").evaluate((m) => ({
            src: m.currentSrc,
            time: m.currentTime,
            duration: m.duration,
            paused: m.paused,
            readyState: m.readyState,
            decodedAudioBytes: m.webkitAudioDecodedByteCount || 0,
            videoWidth: m.videoWidth,
          }));
          if (media.time <= before + 0.3)
            throw Error("Playhead did not continue advancing");
          result = {
            status: "played",
            ...media,
            sameTransaction:
              new URL(media.src).pathname === new URL(original).pathname,
          };
        } catch (e) {
          result = {
            status: "unavailable",
            error: e.message,
            state: await page
              .locator("#audio")
              .evaluate((m) => ({
                src: m.currentSrc,
                time: m.currentTime,
                duration: m.duration,
                paused: m.paused,
                readyState: m.readyState,
                error: m.error?.code || null,
              }))
              .catch(() => null),
          };
        } finally {
          const entry = {
            id,
            title: record?.title,
            artist: record?.artist,
            original,
            elapsedMs: Date.now() - start,
            ...result,
            responses,
            failures,
          };
          report.records.push(entry);
          console.log(
            JSON.stringify({
              id,
              title: entry.title,
              status: entry.status,
              src: entry.src,
              state: entry.state,
            }),
          );
          await page.close();
        }
      }
    }),
  );
} finally {
  await browser.close();
  writeFileSync(
    selectedIds.length === 1
      ? "data/arweave-endless-recheck.json"
      : "data/arweave-playback-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
}
console.log(
  JSON.stringify({
    played: report.records.filter((r) => r.status === "played").length,
    checked: report.records.length,
  }),
);
