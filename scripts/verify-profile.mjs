import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const checks = [];
try {
  await page.goto("http://127.0.0.1:4190/#me");
  await page.locator(".profile-account-card").waitFor({ timeout: 30000 });
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      await page.waitForTimeout(200);
      assert.equal(
        await page.evaluate(() => document.body.scrollWidth <= innerWidth),
        true,
      );
      await page.screenshot({
        path: `captures/my-profile-${width}-${theme}.png`,
      });
      const before = (
        await page
          .locator('[aria-label="Your library"][role="tablist"]')
          .boundingBox()
      ).y;
      await page
        .getByRole("tab", { name: "My playlists", exact: true })
        .click();
      await page
        .getByRole("button", { name: "New playlist", exact: false })
        .waitFor();
      assert.ok(
        Math.abs(
          (
            await page
              .locator('[aria-label="Your library"][role="tablist"]')
              .boundingBox()
          ).y - before,
        ) < 2,
      );
      await page
        .getByRole("tab", { name: "My collection", exact: true })
        .click();
      checks.push({ width, theme, overflow: false, profileTabsStable: true });
    }
  await page.getByRole("tab", { name: "My playlists", exact: true }).click();
  await page
    .getByRole("button", { name: "New playlist", exact: false })
    .click();
  await page
    .locator('#playlist-editor input[name="name"]')
    .fill("Profile QA playlist");
  await page
    .getByRole("button", { name: "Save playlist", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Profile QA playlist", exact: true })
    .waitFor();
  await page.goto("http://127.0.0.1:4190/#me?tab=playlists");
  await page.getByRole("link", { name: /Profile QA playlist/ }).waitFor();
  await page.reload();
  await page.getByRole("link", { name: /Profile QA playlist/ }).waitFor();
  await page.goto(
    "http://127.0.0.1:4190/#record/catalog-8453-d45cbf2bd9dfe1ff1f973a1749a02c810df8b97d-18?tab=collectors",
  );
  await page
    .getByRole("heading", { name: "Collectors in purchase history" })
    .waitFor();
  assert.ok((await page.locator(".collector-card").count()) > 0);
  await page.locator(".song-collectors").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "captures/catalog-purchase-collectors-mobile.png",
  });
  await page.goto(
    "http://127.0.0.1:4190/#record/recovered-sound-10-b85683de9fe5db6f5f35dd12622b1775ea4e2663",
  );
  await page.locator(".music-facts").waitFor();
  assert.match(await page.locator(".music-facts").innerText(), /140 BPM/);
  assert.match(await page.locator(".music-facts").innerText(), /A minor/);
  await page.goto(
    "http://127.0.0.1:4190/#record/park-recovered-zora-12?tab=comments",
  );
  await page.locator("[data-onchain-comment]").first().waitFor();
  assert.deepEqual(errors, []);
  writeFileSync(
    "data/profile-catalog-ui-verification.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        checks,
        localPlaylistPersists: true,
        catalogPurchaseRecipients: true,
        releaseNoteFacts: true,
        newZoraComments: true,
        realSignedIn: false,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      checks,
      localPlaylistPersists: true,
      catalogPurchaseRecipients: true,
      newZoraComments: true,
      errors,
    }),
  );
} finally {
  await browser.close();
}
