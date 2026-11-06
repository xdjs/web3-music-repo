import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
const base = "https://web3-music-repo.vercel.app";
const browser = await chromium.launch({ headless: true }),
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
  errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
const hash = (value) => createHash("sha256").update(value).digest("hex");
try {
  const ir = await page.request.get(base + "/api/catalog?view=index", {
    timeout: 60000,
  });
  assert.equal(ir.status(), 200);
  const indexText = await ir.text(),
    index = JSON.parse(indexText);
  const sr = await page.request.get(base + "/catalog/index.json", {
    timeout: 60000,
  });
  assert.equal(sr.status(), 200);
  assert.equal(hash(await sr.text()), hash(indexText));
  const fr = await page.request.get(base + "/api/catalog", { timeout: 60000 });
  assert.equal(fr.status(), 200);
  const fullText = await fr.text(),
    full = JSON.parse(fullText);
  assert.equal(index.records.length, full.records.length);
  assert.deepEqual(
    index.records.map((r) => r.id),
    full.records.map((r) => r.id),
  );
  assert.ok(
    full.records.filter((r) => r.musicMetadata?.lyrics?.length).length >= 1275,
  );
  assert.ok(index.records.length >= 13640);
  assert.ok(Buffer.byteLength(indexText) < Buffer.byteLength(fullText) * 0.6);
  assert.equal(
    (await page.request.head(base + "/catalog/full.json")).status(),
    200,
  );
  checks.push(
    "API index rewrite matches static index; full API is distinct and has identical record count",
  );
  await page.goto(base + "/#record/record-1956ba25");
  await page.locator("[data-lyrics]").waitFor({ timeout: 30000 });
  await page.locator(".lyrics-panel summary").first().click();
  assert.equal(await page.locator(".lyrics-panel[open]").count(), 1);
  assert.ok(
    (await page
      .locator(".lyrics-panel[open] .original-lyrics")
      .first()
      .evaluate((e) => e.textContent.length)) > 280,
  );
  checks.push("Lazy record details display actual recovered lyrics inline");
  assert.equal(
    await page.locator('meta[property="og:image"]').getAttribute("content"),
    base + "/social/music-nft-recovery-v1.png",
  );
  assert.equal(
    await page.locator('meta[name="twitter:image"]').getAttribute("content"),
    base + "/social/music-nft-recovery-v1.png",
  );
  const cover = await page.evaluate(async (url) => {
    const i = new Image();
    i.src = url;
    await i.decode();
    return { width: i.naturalWidth, height: i.naturalHeight };
  }, base + "/lab-cover-v2.png");
  assert.deepEqual(cover, { width: 1200, height: 630 });
  checks.push("OG/Twitter image and new1200x630Labcover available");
  const artist = index.people.find(
    (p) =>
      p.portrait?.note?.includes("Spinamp") &&
      index.records.some((r) => r.artistId === p.id),
  );
  assert.ok(
    artist,
    "Attributed Spinamp artist portrait must reach public catalog",
  );
  const portraits = [];
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(
        (t) => (document.documentElement.dataset.theme = t),
        theme,
      );
      await page.goto(base + "/#artist/" + artist.id);
      const avatar = page.locator(".artist-identity-avatar img");
      await avatar.waitFor();
      assert.match(
        await page.locator(".artist-identity-bio").innerText(),
        /Spinamp/,
      );
      if (!portraits.length)
        await avatar.evaluate((img) =>
          Promise.race([
            img.decode().catch(() => {}),
            new Promise((resolve) => setTimeout(resolve, 15000)),
          ]),
        );
      const observed = await avatar.evaluate((i) => ({
        loaded: i.complete && i.naturalWidth > 0,
        width: i.naturalWidth,
        url: i.currentSrc || i.src,
      }));
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.screenshot({
        path: `captures/production-spinamp-portrait-${width}-${theme}.png`,
      });
      portraits.push({ width, theme, ...observed });
    }
  assert.deepEqual(errors, []);
  const result = {
    checkedAt: new Date().toISOString(),
    base,
    records: index.records.length,
    people: index.people.length,
    recordsWithLyrics: full.records.filter(
      (r) => r.musicMetadata?.lyrics?.length,
    ).length,
    indexBytes: Buffer.byteLength(indexText),
    fullBytes: Buffer.byteLength(fullText),
    indexETag: ir.headers().etag,
    staticIndexETag: sr.headers().etag,
    checks,
    cover,
    portrait: {
      id: artist.id,
      name: artist.name,
      source: artist.portrait.source,
      views: portraits,
    },
    errors,
  };
  writeFileSync(
    "data/production-final-verification.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
