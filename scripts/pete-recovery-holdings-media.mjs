import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
const items = JSON.parse(
  readFileSync("data/pete-recovery/holdings-priority-reads.json"),
);
const b = await chromium.launch({ headless: true });
const p = await b.newPage();
const results = [];
try {
  for (const x of items) {
    const row = {
      chainId: x.chainId,
      contract: x.item.contractAddress,
      tokenId: x.item.tokenId,
      title: x.metadata.name,
      mediaURI: x.metadata.animation_url,
      checkedAt: new Date().toISOString(),
    };
    const urls = [
      "https://magic.decentralized-content.com/ipfs/",
      "https://ipfs.filebase.io/ipfs/",
    ].map((h) => row.mediaURI.replace("ipfs://", h));
    row.attempts = [];
    for (const url of urls) {
      try {
        await p.goto("about:blank");
        await p.setContent('<video id="m" muted></video>');
        await p.evaluate((url) => {
          const m = document.querySelector("video");
          m.src = url;
          m.play().catch(() => {});
        }, url);
        await p.waitForFunction(
          () => document.querySelector("video").currentTime > 0.5,
          null,
          { timeout: 25000 },
        );
        const state = await p.evaluate(() => {
          const m = document.querySelector("video");
          return {
            status: "played",
            currentTime: m.currentTime,
            duration: m.duration,
            readyState: m.readyState,
            videoWidth: m.videoWidth,
            audioDecodedBytes: m.webkitAudioDecodedByteCount || 0,
          };
        });
        row.attempts.push({ url, ...state });
        Object.assign(row, state, { workingURL: url });
        break;
      } catch (e) {
        row.attempts.push({ url, status: "unavailable", error: e.message });
      } finally {
        await p.evaluate(() => {
          const m = document.querySelector("video");
          m?.pause();
          m?.removeAttribute("src");
          m?.load();
        });
      }
    }
    results.push(row);
    writeFileSync(
      "data/pete-recovery/holdings-media-verification.json",
      JSON.stringify(
        {
          scope:
            "Two exact token media attachments discovered through holdings; advancing playback and decoded audio, not whole-track listening.",
          results,
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify(row));
  }
} finally {
  await b.close();
}
