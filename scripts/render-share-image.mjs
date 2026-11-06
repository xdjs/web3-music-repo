import { chromium } from "playwright";
import { resolve } from "node:path";
import { copyFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.goto("file://" + resolve("public/social/music-nft-recovery.html"));
  await page.evaluate(() => document.fonts.ready);
  assert.equal(
    await page
      .locator("img")
      .evaluate((i) => i.complete && i.naturalWidth === 4000),
    true,
  );
  assert.ok(
    await page
      .locator("h1")
      .evaluate((e) => e.getBoundingClientRect().right <= 1200),
  );
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument");
  const { nodeId } = await cdp.send("DOM.querySelector", {
    nodeId: root.nodeId,
    selector: "h1",
  });
  const fonts = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
  assert.ok(
    fonts.fonts.some((f) => f.familyName === ".SF NS"),
    "Render on the verified macOS SF system-font environment to match live Music Nerd",
  );
  await page.screenshot({ path: "public/social/music-nft-recovery-v1.png" });
  copyFileSync(
    "public/social/music-nft-recovery-v1.png",
    "public/lab-cover-v2.png",
  );
  await page.setViewportSize({ width: 400, height: 210 });
  await page.evaluate(() => {
    document.querySelector(".scene").style.transform = "scale(0.3333333333)";
    document.querySelector(".scene").style.transformOrigin = "top left";
    document.body.style.width = "400px";
    document.documentElement.style.width = "400px";
    document.body.style.height = "210px";
    document.documentElement.style.height = "210px";
  });
  await page.screenshot({ path: "public/social/music-nft-recovery-thumb.png" });
  writeFileSync(
    "public/social/share-image-provenance.json",
    JSON.stringify(
      {
        renderedAt: new Date().toISOString(),
        dimensions: { width: 1200, height: 630 },
        reference:
          "https://musicnerd.net/social/music-nerd-record-sleeve-v1.png",
        brandReference: "https://musicnerd.net/",
        logoSource: "https://musicnerd.net/musicNerdLogo.png",
        fontStack: "ui-sans-serif, system-ui, sans-serif",
        platformFonts: fonts.fonts,
        notes:
          "Current live Music Nerd loads no custom fonts. CDP confirms SF NS Bold on macOS. Existing KoHo CSS declarations are not the active website font. Raster output is fixed and self-contained; source assets are local.",
      },
      null,
      2,
    ) + "\n",
  );
  console.log("Rendered1200x630 and400x210 with verified live system font");
} finally {
  await browser.close();
}
