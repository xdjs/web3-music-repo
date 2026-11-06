import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { readNFT } from "../src/nft-reader.mjs";
import { alternateMediaURLs } from "../src/media-recovery.js";
const bundle = JSON.parse(readFileSync("data/spinamp/recovered-media.json"));
const samples = [
  bundle.records.find((r) => /HOOTY HOO/i.test(r.title)),
  bundle.records.find((r) => /DIGITAL DAYDREAM/i.test(r.title)),
  bundle.records.find((r) => r.platform === "Lens"),
].filter(Boolean);
const browser = await chromium.launch({ headless: true }),
  page = await browser.newPage(),
  results = [];
try {
  for (const r of samples) {
    const e = bundle.evidence[r.id],
      row = {
        id: r.id,
        title: r.title,
        artist: r.artist,
        chainId: r.chainId,
        contract: r.contract,
        tokenId: r.tokenId,
        mediaURI: e.mediaURI,
        sourceType: e.sourceType,
        originalMediaMissing: e.originalMediaMissing,
        checkedAt: new Date().toISOString(),
        attempts: [],
      };
    try {
      const chain = await readNFT(r);
      row.chainRead = {
        status: chain.status,
        mediaURI: chain.mediaURI,
        metadataURI: chain.metadataURI,
        referenceBlock: chain.referenceBlock,
        message: chain.message,
      };
    } catch (error) {
      row.chainRead = { status: "failed", error: error.message };
    }
    for (const url of [e.mediaURL, ...alternateMediaURLs(e.mediaURL)].slice(
      0,
      3,
    )) {
      try {
        await page.goto("about:blank");
        await page.setContent("<video muted></video>");
        await page.evaluate((url) => {
          const m = document.querySelector("video");
          m.src = url;
          m.play().catch(() => {});
        }, url);
        await page.waitForFunction(
          () => document.querySelector("video").currentTime > 0.5,
          null,
          { timeout: 25000 },
        );
        const state = await page.evaluate(() => {
          const m = document.querySelector("video");
          return {
            status: "played",
            currentTime: m.currentTime,
            duration: m.duration,
            videoWidth: m.videoWidth,
            audioDecodedBytes: m.webkitAudioDecodedByteCount || 0,
          };
        });
        row.attempts.push({ url, ...state });
        Object.assign(row, state);
        break;
      } catch (error) {
        row.attempts.push({ url, status: "unavailable", error: error.message });
      } finally {
        await page.evaluate(() => {
          const m = document.querySelector("video");
          m.pause();
          m.removeAttribute("src");
          m.load();
        });
      }
    }
    results.push(row);
    writeFileSync(
      "data/spinamp/sample-verification.json",
      JSON.stringify(
        {
          scope:
            "Three independently selected indexed-original or explicitly preserved-media samples; advancing playback and decoded audio, not full catalog playback verification.",
          results,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(JSON.stringify(row));
  }
} finally {
  await browser.close();
}
