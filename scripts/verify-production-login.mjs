import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [],
  authResponses = [],
  checks = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("response", (response) => {
  if (
    response.url().includes("auth.privy.io/api/v1/apps/") ||
    response.url().endsWith("/embedded-wallets")
  )
    authResponses.push({
      url: response.url().split("?")[0],
      status: response.status(),
    });
});
mkdirSync("captures", { recursive: true });
try {
  const response = await page.request.get(
    "https://web3-music-repo.vercel.app/api/auth/config",
  );
  const config = await response.json();
  assert.ok(config.enabled);
  assert.equal(
    config.clientId,
    "client-WY6W53j4q1dvp15KJx1zc88MivQTj6NJ66S4CKzsxEAdJ",
  );
  assert.equal(config.playlistStorage, "private-blob");
  await page.goto("https://web3-music-repo.vercel.app/#me");
  await page.locator(".profile-account-card").waitFor({ timeout: 30000 });
  const button = page
    .locator(".profile-account-card")
    .getByRole("button", { name: "Sign in", exact: true });
  await button.waitFor();
  await button.click({ timeout: 30000 });
  await page.getByPlaceholder(/email/i).waitFor({ timeout: 30000 });
  const body = await page.locator("body").innerText();
  assert.match(body, /wallet/i);
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      await page.waitForTimeout(250);
      const overflow = await page.evaluate(
        () => document.body.scrollWidth > innerWidth,
      );
      assert.equal(overflow, false);
      await page.screenshot({
        path: `captures/privy-production-login-${width}-${theme}.png`,
      });
      checks.push({
        width,
        theme,
        overflow,
        emailFormVisible: await page.getByPlaceholder(/email/i).isVisible(),
      });
    }
  assert.equal(
    authResponses.filter((response) => response.status === 403).length,
    0,
  );
  assert.deepEqual(errors, []);
  const result = {
    checkedAt: new Date().toISOString(),
    scope:
      "Real Privy SDK and configured recovery client, guest login modal only. No OTP sent; no wallet signed; real account completion not verified.",
    config,
    checks,
    authResponses,
    errors,
  };
  writeFileSync(
    "data/privy-production-login-verification.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
