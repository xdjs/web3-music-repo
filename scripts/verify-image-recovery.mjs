import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.VERIFY_BASE_URL || "http://127.0.0.1:4190";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const cid = "QmTwApPoQx3AiXA8LM6grikDs8CovxNY5id5fzaVDTZs3Q";
const id = "mint-songs-137-c29cbe04ae322469dc077741afa2fbccda748ae4-60000";
const errors = [],
  checks = [],
  attempts = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (response) => {
  if (response.url().includes(cid))
    attempts.push({ url: response.url(), status: response.status() });
});
async function loadedArt() {
  const art = page.locator(".record-head .cover img");
  await art.scrollIntoViewIfNeeded();
  await page.waitForFunction(
    () => {
      const image = document.querySelector(".record-head .cover img");
      return image?.complete && image.naturalWidth > 0;
    },
    null,
    { timeout: 45000 },
  );
  return art.evaluate((image) => ({
    source: image.currentSrc,
    width: image.naturalWidth,
    height: image.naturalHeight,
    alt: image.alt,
  }));
}
try {
  await page.goto(`${base}/#record/${id}`);
  const initial = await loadedArt();
  assert.ok(initial.source.includes(cid));
  checks.push({ name: "TAY original artwork", ...initial });
  let forced = 0;
  await page.route(`https://gateway.pinata.cloud/ipfs/${cid}`, (route) => {
    forced++;
    return route.fulfill({ status: 429, body: "Fixture gateway rate limit" });
  });
  await page
    .locator(".record-head .cover img")
    .evaluate(
      (image, cid) => (image.src = `https://gateway.pinata.cloud/ipfs/${cid}`),
      cid,
    );
  await page.waitForFunction(
    () =>
      !document
        .querySelector(".record-head .cover img")
        ?.src.includes("gateway.pinata.cloud"),
    null,
    { timeout: 15000 },
  );
  const fallback = await loadedArt();
  assert.ok(forced > 0);
  assert.ok(fallback.source.includes(cid));
  checks.push({
    name: "Forced Pinata 429 with real same-CID fallback",
    forcedRequests: forced,
    ...fallback,
  });
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.screenshot({
        path: `captures/image-recovery-${width}-${theme}.png`,
      });
      checks.push({
        name: "Rendered TAY artwork",
        width,
        theme,
        overflow: false,
      });
    }
  await page.goto(`${base}/#record/record-69c77ef0`);
  checks.push({
    name: "Existing MIAMI FREESTYLE artwork",
    ...(await loadedArt()),
  });
  assert.deepEqual(errors, []);
  const result = {
    checkedAt: new Date().toISOString(),
    scope:
      "Selected real artwork loads plus one forced gateway429. Not an all-image availability audit.",
    checks,
    attempts,
    errors,
  };
  writeFileSync(
    "data/image-recovery-verification.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
