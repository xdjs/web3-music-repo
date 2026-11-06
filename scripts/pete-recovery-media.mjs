import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
const collections = JSON.parse(
  readFileSync("data/pete-recovery/zora-collection-reads.json"),
).collections;
const metadata = {};
for (const c of collections) {
  const uri = c.calls.find((x) => x.name === "tokenURI1")?.decoded;
  if (uri?.startsWith("data:"))
    metadata[c.contract] = JSON.parse(
      Buffer.from(uri.split(",")[1], "base64").toString(),
    );
  else
    metadata[c.contract] = JSON.parse(
      readFileSync("work/pete-zora/keepers-metadata.json"),
    );
}
writeFileSync(
  "data/pete-recovery/zora-original-metadata.json",
  JSON.stringify(metadata, null, 2),
);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const results = [];
try {
  for (const c of collections) {
    const m = metadata[c.contract];
    if (!m.animation_url) {
      results.push({
        contract: c.contract,
        title: m.name,
        status: "no_animation_in_token1",
        note: "Collection preview video does not establish audio attachment for this token.",
      });
      continue;
    }
    const url = m.animation_url.replace(
      "ipfs://",
      "https://magic.decentralized-content.com/ipfs/",
    );
    const row = {
      contract: c.contract,
      title: m.name,
      mediaURI: m.animation_url,
      url,
      checkedAt: new Date().toISOString(),
    };
    try {
      await page.goto("about:blank");
      await page.setContent('<video id="m" muted controls></video>');
      await page.evaluate((url) => {
        const m = document.querySelector("video");
        m.src = url;
        m.play().catch(() => {});
      }, url);
      await page.waitForFunction(
        () => document.querySelector("video").currentTime > 0.5,
        null,
        { timeout: 30000 },
      );
      Object.assign(
        row,
        await page.evaluate(() => {
          const m = document.querySelector("video");
          return {
            status: "played",
            currentTime: m.currentTime,
            duration: m.duration,
            readyState: m.readyState,
            videoWidth: m.videoWidth,
            videoHeight: m.videoHeight,
            audioDecodedBytes: m.webkitAudioDecodedByteCount || 0,
            videoDecodedBytes: m.webkitVideoDecodedByteCount || 0,
          };
        }),
      );
    } catch (e) {
      row.status = "unavailable";
      row.error = e.message;
    } finally {
      await page.evaluate(() => {
        const m = document.querySelector("video");
        m?.pause();
        m?.removeAttribute("src");
        m?.load();
      });
    }
    results.push(row);
    writeFileSync(
      "data/pete-recovery/zora-media-verification.json",
      JSON.stringify(
        {
          scope:
            "Original token metadata media playback beyond 0.5s; not whole-track listening.",
          results,
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify(row));
  }
} finally {
  await browser.close();
}
