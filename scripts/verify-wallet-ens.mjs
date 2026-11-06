import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.ARCHIVE_QA_URL || "http://127.0.0.1:4191";
const browser = await chromium.launch({ headless: true }),
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
  errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
// Keep this public lookup independent from personal authentication. ENS and all
// wallet HTTP requests below use the actual running backend, with no fixtures.
await page.route("**/api/auth/config", (r) =>
  r.fulfill({ json: { enabled: false } }),
);
try {
  await page.goto(base + "/#wallet");
  await page.locator("#wallet-lookup input").fill("vitalik.eth");
  const responsePromise = page.waitForResponse((r) =>
    r.url().includes("/api/wallet/resolve?name=vitalik.eth"),
  );
  await page.locator("#wallet-lookup button").click();
  const response = await responsePromise,
    resolution = await response.json();
  assert.equal(response.status(), 200);
  assert.equal(resolution.status, "resolved");
  assert.equal(
    resolution.address.toLowerCase(),
    "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
  );
  await page.waitForFunction(
    (address) =>
      document.querySelector("#wallet-lookup input")?.value === address,
    resolution.address.toLowerCase(),
  );
  assert.match(
    await page.locator("[data-wallet-resolution]").innerText(),
    /vitalik.eth/,
  );
  assert.ok(await page.locator("[data-wallet-resolution] a").count());
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(
        (t) => (document.documentElement.dataset.theme = t),
        theme,
      );
      await page.screenshot({
        path: `captures/wallet-ens-${width}-${theme}.png`,
      });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      checks.push({
        width,
        theme,
        normalizedAddress: true,
        ensNameAndSourceVisible: true,
        noOverflow: true,
      });
    }
  assert.deepEqual(errors, []);
  const result = {
    checkedAt: new Date().toISOString(),
    base,
    scope:
      "Real Ethereum ENS resolution and wallet API in a public lookup; sign-in configuration disabled only in this browser fixture. No wallet linked or signature requested.",
    resolution,
    checks,
    errors,
  };
  writeFileSync(
    "data/wallet-ens-ui-verification.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
