import { test, expect } from "@playwright/test";

test("an inline name opens context, social links and a nested source without losing place", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.locator("#story-release .beat-evidence summary").first().click();
  const name = page
    .locator("#story-release .film-copy")
    .first()
    .getByRole("link", { name: "Benjamin James", exact: true })
    .last();
  await name.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => scrollY);
  await name.click();
  await expect(page.getByRole("dialog")).toContainText("Writer · STVDIO");
  await expect(
    page
      .getByRole("navigation", { name: "Benjamin James online" })
      .getByRole("link", { name: "X ↗", exact: true }),
  ).toHaveAttribute("href", "https://x.com/musicben_eth");
  await expect(page.locator(".person-bio")).toContainText("label experience");
  await page.screenshot({
    path: `captures/benjamin-profile-${info.project.name}.png`,
    animations: "disabled",
  });
  await page
    .locator("#sheet")
    .getByRole("link", { name: /WEB3 MUSIC/ })
    .click();
  await expect(page.locator("#sheet-title")).toContainText("WEB3 MUSIC");
  await page.locator("#sheet-back").click();
  await expect(page.locator("#sheet-title")).toHaveText("Benjamin James");
  await page.keyboard.press("Escape");
  await expect(name).toBeFocused();
  expect(Math.abs((await page.evaluate(() => scrollY)) - before)).toBeLessThan(
    8,
  );
});

test("chapter participants and recording collaborators have usable drawers", async ({
  page,
}) => {
  await page.goto("/#/moment/future-surf");
  await page
    .locator(".story-narrative")
    .getByRole("link", { name: "Jamee Cornelia", exact: true })
    .click();
  await expect(page.locator(".person-bio")).toContainText("alternative rapper");
  await expect(
    page.getByRole("link", { name: "Artist site & socials ↗", exact: true }),
  ).toHaveAttribute("href", "https://artschooldropout.carrd.co/");
  await page.keyboard.press("Escape");
  await page.goto("/#/records?collection=CHAOS");
  const artist = page
    .locator(".nft-card .small-label a.person-mention")
    .filter({ hasText: "Three Oscillators" })
    .first();
  await artist.click();
  await expect(page.locator("#sheet-title")).toHaveText("Three Oscillators");
  await expect(page.locator(".artist-nfts button").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/#/moment/eternal-garden");
  await page
    .locator(".story-narrative")
    .getByRole("link", { name: "TK", exact: true })
    .first()
    .click();
  await expect(page.locator("#sheet-title")).toHaveText("TK");
  await expect(page.locator(".artist-nfts")).toContainText("Never Forget");
});

test("opening and closing a person from a recording preserves its player element", async ({
  page,
}) => {
  await page.route("**/api/nft/**", (route) =>
    route.fulfill({
      json: {
        status: "live",
        title: "Calm Down",
        blockNumber: 123,
        contract: "0x" + "a".repeat(40),
        tokenId: "91",
        kind: "audio",
        metadataLocation: "Test metadata",
        mediaURI: "ipfs://test/song.wav",
        mediaURL: "https://ipfs.filebase.io/ipfs/test/song.wav",
      },
    }),
  );
  await page.route("https://ipfs.filebase.io/**", (route) => route.abort());
  await page.goto("/#/records?q=Black%20Dave");
  await page
    .getByRole("button", { name: "Play Black Dave - Calm Down", exact: true })
    .click();
  await expect(page.locator("audio")).toHaveCount(1);
  await page
    .locator("audio")
    .evaluate((audio) => (audio.dataset.continuity = "retained"));
  await page
    .locator(".nft-card .small-label")
    .getByRole("link", { name: "Black Dave", exact: true })
    .click();
  await expect(page.locator("#sheet-title")).toHaveText("Black Dave MK2");
  await expect(page.locator("audio")).toHaveAttribute(
    "data-continuity",
    "retained",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("audio")).toHaveAttribute(
    "data-continuity",
    "retained",
  );
});

test("platform context is available in place and Imogen has a complete passage", async ({
  page,
}, info) => {
  await page.goto("/");
  const passage = page.locator("#story-release .film-copy").nth(1);
  await passage.scrollIntoViewIfNeeded();
  await expect(page.locator("#story-release")).toHaveAttribute(
    "data-active-beat",
    "1",
  );
  await expect
    .poll(() =>
      page
        .locator(
          info.project.name === "phone"
            ? ".heap-mobile-art img"
            : ".frame-ujo img",
        )
        .evaluate((img) => img.complete && img.naturalWidth > 0),
    )
    .toBe(true);
  await expect(passage).toContainText("maintaining it took resources");
  await expect(
    passage.getByRole("link", { name: "Mycelia", exact: true }).last(),
  ).toBeVisible();
  await page.screenshot({
    path: `captures/imogen-context-${info.project.name}.png`,
    animations: "disabled",
  });
  const zora = page
    .locator("#story-release .film-copy")
    .nth(2)
    .getByRole("link", { name: "Zora", exact: true })
    .last();
  await zora.scrollIntoViewIfNeeded();
  const position = await page.evaluate(() => scrollY);
  await zora.click();
  await expect(page.locator("#sheet-title")).toHaveText("Zora");
  await expect(page.locator(".person-bio")).toContainText(
    "beyond a single storefront",
  );
  await expect(page.locator("#sheet")).toContainText("Platform, in context");
  await expect(
    page.locator("#sheet").getByRole("link", { name: "Catalog", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `captures/zora-context-${info.project.name}.png`,
    animations: "disabled",
  });
  await page
    .locator("#sheet")
    .getByRole("link", { name: "Catalog", exact: true })
    .click();
  await expect(page.locator("#sheet-title")).toHaveText("Catalog");
  await page.locator("#sheet-back").click();
  await expect(page.locator("#sheet-title")).toHaveText("Zora");
  await page.keyboard.press("Escape");
  await expect(zora).toBeFocused();
  expect(
    Math.abs((await page.evaluate(() => scrollY)) - position),
  ).toBeLessThan(8);
});

test("record library filters contributors and collections without privileging CHAOS", async ({
  page,
}, info) => {
  await page.goto("/#/records");
  await expect(page.locator(".collection-spotlight")).toHaveCount(0);
  await page.getByLabel("Artists", { exact: true }).selectOption("Pete Rango");
  await expect(page.locator(".nft-card")).toHaveCount(2);
  await expect(page.locator(".nft-grid")).toContainText("NOT4ME");
  await expect(page.locator(".nft-grid")).toContainText("MIAMI FREESTYLE");
  await page.screenshot({
    path: `captures/contributor-filter-${info.project.name}.png`,
    animations: "disabled",
  });
  await page.getByLabel("Artists", { exact: true }).selectOption("Xcelencia");
  await expect(page.locator(".nft-card")).toHaveCount(4);
  await expect(page.locator(".nft-grid")).toContainText("Soltera");
  await page.getByLabel("Artists", { exact: true }).selectOption("");
  await page.getByLabel("Collections", { exact: true }).selectOption("CHAOS");
  await expect(page.locator(".nft-card")).toHaveCount(43);
  await page.goto("/#/?person=eprom");
  const photo = page.locator(".person-portrait img");
  await expect(photo).toBeVisible();
  await expect
    .poll(() => photo.evaluate((img) => img.complete && img.naturalWidth > 0))
    .toBe(true);
  await page.screenshot({
    path: `captures/eprom-profile-${info.project.name}.png`,
    animations: "disabled",
  });
});

test("profiles lead with playable artwork and stop their local player on close", async ({
  page,
}, info) => {
  await page.route("**/api/nft/**", (route) =>
    route.fulfill({ json: { status: "unavailable" } }),
  );
  await page.goto("/#/?person=pete-rango");
  const work = page.locator(".artist-nfts .nft-card").first();
  await expect(work).toContainText("Mixing & mastering");
  await expect(work.locator(".record-artwork img")).toHaveCount(1);
  await expect
    .poll(() =>
      work
        .locator(".record-artwork img")
        .evaluate((img) => img.complete && img.naturalWidth > 0),
    )
    .toBe(true);
  await work.locator(".artwork-play").click();
  await expect(work.locator(".inline-player-status")).toBeVisible();
  await page.screenshot({
    path: `captures/profile-work-${info.project.name}.png`,
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await expect(page.locator(".inline-record-player")).toHaveCount(0);
});
