import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const origin = "https://web3-music-archive.vercel.app";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const report = {
  checkedAt: new Date().toISOString(),
  deploymentId: process.env.RELEASE_DEPLOYMENT_ID || null,
  sourceCommit: process.env.RELEASE_SOURCE_COMMIT || null,
  origin,
  scope:
    "Real production SDK guest modal and isolated browser-local playlist only. No OTP, wallet signature, authenticated account write or real account sync claim.",
  checks: [],
  authResponses: [],
  errors: [],
  status: "running",
};
page.on("pageerror", (e) => report.errors.push(e.message));
page.on("response", (r) => {
  if (r.url().includes("auth.privy.io/api/v1/apps/"))
    report.authResponses.push({
      url: r.url().split("?")[0],
      status: r.status(),
    });
});
try {
  const res = await page.request.get(origin + "/api/auth/config");
  assert.equal(res.status(), 200);
  const config = await res.json();
  assert.equal(config.enabled, true);
  assert.equal(
    config.clientId,
    "client-WY6W53j4q1dvp15KJx1zc88MivQTj6NJ66S4CKzsxEAdJ",
  );
  assert.equal(config.playlistStorage, "private-blob");
  report.config = config;
  await page.goto(origin + "/#playlists", { waitUntil: "domcontentloaded" });
  await page.locator("[data-new-playlist]").waitFor({ timeout: 45000 });
  await page.locator("[data-new-playlist]").click();
  await page
    .locator("#playlist-editor input[name=name]")
    .fill("Origin smoke playlist");
  await page.locator("#playlist-editor button[type=submit]").click();
  await page
    .getByRole("heading", { name: "Origin smoke playlist", exact: true })
    .waitFor();
  const guest = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("mn-archive-playlists-v1")),
  );
  assert.equal(guest.length, 1);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page
    .getByRole("heading", { name: "Origin smoke playlist", exact: true })
    .waitFor({ timeout: 45000 });
  report.checks.push({
    name: "Guest playlist creation and reload in isolated new-origin browser",
    passed: true,
  });
  await page.goto(origin + "/#me");
  await page.locator(".profile-account-card").waitFor({ timeout: 30000 });
  assert.equal(
    await page
      .getByRole("button", {
        name: /Save playlists to account|Load account playlists/,
      })
      .count(),
    0,
  );
  await page
    .locator(".profile-account-card")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await page.getByPlaceholder(/email/i).waitFor({ timeout: 30000 });
  assert.match(await page.locator("body").innerText(), /wallet/i);
  for (const { width, theme } of [
    { width: 1440, theme: "light" },
    { width: 390, theme: "dark" },
  ]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(
      (theme) => (document.documentElement.dataset.theme = theme),
      theme,
    );
    await page.waitForTimeout(250);
    assert.equal(
      await page.evaluate(() => document.body.scrollWidth > innerWidth),
      false,
    );
    assert.equal(await page.getByPlaceholder(/email/i).isVisible(), true);
    await page.screenshot({
      path: `captures/production-archive-origin-login-${width}-${theme}.png`,
    });
    report.checks.push({
      name: "Real email and wallet modal",
      width,
      theme,
      passed: true,
    });
  }
  assert.ok(report.authResponses.some((r) => r.status === 200));
  assert.equal(
    report.authResponses.some((r) => r.status === 403),
    false,
  );
  assert.deepEqual(report.errors, []);
  const old = await page.request.get("https://web3-music-repo.vercel.app/", {
    maxRedirects: 0,
  });
  assert.equal(old.status(), 200);
  report.checks.push({
    name: "Previous origin remains directly available without redirect",
    passed: true,
  });
  report.status = "passed";
} catch (e) {
  report.status = "failed";
  report.failure = e.stack;
  throw e;
} finally {
  writeFileSync(
    "data/production-archive-origin-login-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
  await browser.close();
}
