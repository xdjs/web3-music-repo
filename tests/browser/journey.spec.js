import { nftCatalog } from "../../src/nft-catalog.js";
import { chapter, moments } from "../../src/data.js";
import { test, expect } from "@playwright/test";

for (const theme of ["dark", "light"]) {
  test(`curated path, evidence, relationship and history in ${theme}`, async ({
    page,
  }, info) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(
      (t) => localStorage.setItem("era-theme", t),
      theme,
    );
    await page.route("**/api/directory/**", (r) =>
      r.fulfill({ json: { status: "unavailable" } }),
    );
    await page.goto("/");
    await expect(page.locator("iframe")).toHaveCount(0);
    await expect(page.locator(".film-hero-photo")).toHaveCount(1);
    await expect
      .poll(() =>
        page
          .locator(".film-hero-photo")
          .evaluateAll((images) =>
            images.every((image) => image.complete && image.naturalWidth > 0),
          ),
      )
      .toBe(true);
    await expect(page.locator("h1")).toHaveText("A scene,in the making.");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `captures/opening-${info.project.name}-${theme}.png`,
      fullPage: false,
      animations: "disabled",
    });
    await page.locator(".chapter-menu > summary").click();
    await expect(
      page.getByRole("link", { name: /About this chapter/ }),
    ).toBeVisible();
    await page.locator(".chapter-menu > summary").click();
    await page.locator("#story-collect .beat-evidence summary").click();
    await page
      .locator("#story-collect")
      .getByRole("link", { name: "Explore this thread" })
      .click();
    await expect(page).toHaveURL(/#\/moment\/music-nft$/);
    const tokens = page.getByRole("tab", { name: "The token", exact: true });
    await tokens.click();
    await expect(page.getByRole("tabpanel")).toContainText("Minting");
    await tokens.focus();
    await page.keyboard.press("ArrowRight");
    await expect(
      page.getByRole("tab", { name: "The relationship", exact: true }),
    ).toBeFocused();
    await expect(page.getByRole("tabpanel")).toContainText("Copyright");
    await page.getByRole("link", { name: "Check the distinction" }).click();
    await expect(page.locator("#sheet-title")).toContainText("ownership");
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/#\/moment\/music-nft$/);
    for (const id of chapter.slice(1, chapter.indexOf("walls") + 1)) {
      await page.getByRole("link", { name: "Next scene", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`#\\/moment\\/${id}$`));
      await expect(page.locator("h1")).toHaveText(
        moments.find((m) => m.id === id).title,
      );
    }
    await page
      .locator(".person-chip")
      .filter({ hasText: "Three Oscillators" })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Three Oscillators" }),
    ).toBeVisible();
    await expect(page.locator("#directory-status")).toContainText(
      "Music Nerd is taking a moment",
    );
    await page.screenshot({
      path: `captures/relationship-${info.project.name}-${theme}.png`,
      fullPage: false,
      animations: "disabled",
    });
    await page
      .getByRole("link", { name: "Boy Untitled ↗", exact: true })
      .click();
    await expect(page.locator("#sheet-title")).toHaveText("Boy Untitled");
    await page.getByRole("button", { name: "← Back", exact: true }).click();
    await expect(page.locator("#sheet-title")).toHaveText("Three Oscillators");
    await page
      .locator(".relationship")
      .filter({ hasText: "Boy Untitled" })
      .getByRole("link", { name: "Inspect evidence" })
      .click();
    await expect(page.locator("#sheet-title")).toContainText("oral history");
    await expect(
      page.getByRole("link", { name: "Open original source" }),
    ).toHaveAttribute("href", /archive.metalabel.com/);
    await page.getByRole("button", { name: "Close detail" }).click();
    await expect(page.locator("#sheet")).not.toBeVisible();
    await expect(page).toHaveURL(/#\/moment\/walls$/);
    await expect(
      page.locator(".person-chip").filter({ hasText: "Three Oscillators" }),
    ).toBeFocused();
    await page.screenshot({
      path: `captures/walls-${info.project.name}-${theme}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.getByRole("link", { name: "Next in the chapter" }).click();
    await expect(page).toHaveURL(/#\/moment\/zoratopia$/);
    await page.goBack();
    await expect(page).toHaveURL(/#\/moment\/walls$/);
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
    for (const id of chapter.slice(chapter.indexOf("walls") + 1)) {
      await page.getByRole("link", { name: "Next in the chapter" }).click();
      await expect(page.locator("h1")).toHaveText(
        moments.find((m) => m.id === id).title,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
    }
    await page.getByRole("link", { name: "Find someone to hear next" }).click();
    await page.getByRole("button", { name: /People & projects \d/ }).click();
    await page.getByRole("searchbox").fill("Dutch");
    await page.locator(".people-index a").click();
    await expect(page.locator("#sheet-title")).toHaveText("Dutchyyy");
    await page.keyboard.press("Escape");
    await expect(page.locator("#sheet")).not.toBeVisible();
    await expect(page.getByRole("searchbox")).toHaveValue("Dutch");
    await expect(page.locator(".people-index a")).toHaveCount(1);
    await page.getByRole("searchbox").fill("no matching person");
    await expect(
      page.getByRole("heading", { name: "No match in this chapter." }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}
test("direct detail link, keyboard focus and reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/moment/walls?source=walls");
  await expect(page.locator("#sheet-title")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#sheet")).not.toBeVisible();
  await expect(page.locator("h1")).toContainText("Two weeks");
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to the story" }),
  ).toBeFocused();
  await page.locator(".chapter-menu > summary").click();
  const link = page.getByRole("button", { name: "Jump to How it began" });
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#story-title-release")).toBeFocused();
  expect(
    await page.evaluate(
      () =>
        document.getAnimations().filter((a) => a.playState === "running")
          .length,
    ),
  ).toBe(0);
});
test("media is opt-in, has fallback, and is destroyed on stop", async ({
  page,
}) => {
  await page.route("https://bandcamp.com/**", (r) => r.abort());
  await page.goto("/");
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.getByRole("button", { name: "NOKMLY remixes" }).click();
  await expect(page.locator("#listening")).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(1);
  await expect(page.locator("iframe")).toHaveAttribute(
    "src",
    /album=1347599098/,
  );
  await expect(page.locator("iframe")).not.toHaveAttribute("allow", /autoplay/);
  await expect(
    page.getByRole("link", { name: "Open the artist’s Bandcamp" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stop & close" }).click();
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "NOKMLY remixes" }),
  ).toBeFocused();
});
test("server does not expose private files or write methods", async ({
  request,
}) => {
  for (const path of [
    "/.firecrawl/wallet-nfts.json",
    "/docs/TRACKING.md",
    "/src/directory.js",
    "/.git/config",
    "/api/directory/unknown",
  ])
    expect((await request.get(path)).status()).toBe(404);
  expect(
    (
      await request.post("/api/directory/dutchyyy", {
        data: { name: "changed" },
      })
    ).status(),
  ).toBe(405);
});
test("a stalled directory request times out without stranding the story", async ({
  page,
}) => {
  await page.clock.install();
  await page.route("**/api/directory/**", () => {});
  await page.goto("/#/moment/remix?person=three-oscillators");
  await expect(page.locator("#directory-status")).toContainText("Checking");
  await page.clock.runFor(8100);
  await expect(page.locator("#directory-status")).toContainText(
    "Music Nerd is taking a moment",
  );
  await page.getByRole("button", { name: "Close detail" }).click();
  await expect(page).toHaveURL(/#\/moment\/remix$/);
});

test("scrolling reveals the story without entering a route and preserves source detours", async ({
  page,
}) => {
  await page.goto("/");
  const beat = page.locator("#story-rooms .scroll-beat").first();
  await beat.scrollIntoViewIfNeeded();
  await expect(beat.getByRole("heading")).toHaveText("The room was a link.");
  await expect(page).not.toHaveURL(/moment/);
  const before = await page.evaluate(() => scrollY);
  await beat.locator(".beat-evidence summary").click();
  await beat
    .getByRole("link", { name: "Source notes" })
    .scrollIntoViewIfNeeded();
  const expanded = await page.evaluate(() => scrollY);
  await beat.getByRole("link", { name: "Source notes" }).click();
  await expect(page.locator("#sheet")).toBeVisible();
  await expect(page.locator("#sheet-title")).not.toHaveText("Source not found");
  await page.keyboard.press("Escape");
  await expect(page.locator("#sheet")).not.toBeVisible();
  expect(
    Math.abs((await page.evaluate(() => scrollY)) - expanded),
  ).toBeLessThan(5);
  const last = page.locator("#story-remain .scroll-beat").last();
  await last.scrollIntoViewIfNeeded();
  await expect(last.getByRole("heading")).toHaveText(
    "What did people carry forward?",
  );
  await expect(page.locator("iframe")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("chapter rail, format comparison and return to the documentary", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator(".chapter-menu > summary").click();
  const jump = page.getByRole("button", {
    name: "Jump to Reinventing the release",
  });
  await jump.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#story-editions h2").first()).toBeFocused();
  const comparison = page.locator(".format-comparison");
  await comparison.locator("summary").click();
  await expect(
    comparison.getByText("Shared payments", { exact: true }),
  ).toBeVisible();
  await comparison.getByRole("link", { name: "Overstimulated" }).click();
  await expect(page.locator("#sheet")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(comparison).toHaveAttribute("open", "");
  await page
    .locator("#story-release .scroll-beat")
    .last()
    .locator(".beat-evidence summary")
    .click();
  await page
    .locator("#story-release")
    .getByRole("link", { name: "Inside Catalog" })
    .click();
  await expect(page).toHaveURL(/moment\/catalog/);
  await page.goBack();
  await expect(page.locator(".documentary-rail")).toBeVisible();
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(1000);
});

test("NFT plays inline on request, preserves provenance, and stops on navigation", async ({
  page,
}) => {
  let reads = 0;
  await page.route("**/api/nft/**", (route) => {
    reads++;
    return route.fulfill({
      json: {
        status: "live",
        title: "Calm Down",
        chainId: 1,
        blockNumber: 123,
        contract: "0x" + "a".repeat(40),
        tokenId: "91",
        kind: "audio",
        metadataLocation: "Metadata returned directly by the contract",
        mediaURI: "ipfs://test/song.wav",
        mediaURL: "https://ipfs.filebase.io/ipfs/test/song.wav",
      },
    });
  });
  await page.route("https://ipfs.filebase.io/**", (route) => route.abort());
  await page.goto("/#/records?q=Black%20Dave");
  expect(reads).toBe(0);
  await expect(page.locator("audio,video")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Play Black Dave - Calm Down", exact: true })
    .click();
  await expect(page.locator("audio")).toHaveAttribute("preload", "none");
  await expect(page.locator("audio")).not.toHaveAttribute("autoplay", "");
  await page.getByText("The edition & collection", { exact: true }).click();
  await page.getByText("Recording source", { exact: true }).click();
  await expect(page.locator(".nft-provenance")).toContainText(
    "Ethereum block 123",
  );
  await expect(page.locator("#listening-room[open]")).toHaveCount(0);
  await page.getByRole("link", { name: "Return to the documentary" }).click();
  await expect(page.locator("audio,video")).toHaveCount(0);
  await expect(page).toHaveURL(/#\/$/);
});

test("collection pagination retains full token IDs and failed reads remain retryable", async ({
  page,
}) => {
  const token = "1361129467683753853853498429727072845879";
  let requested = "";
  await page.route("**/api/collection/**", (r) =>
    r.fulfill({
      json: {
        status: "indexed",
        items: [{ tokenId: token, title: "An edition", imageURL: null }],
        nextCursor: null,
      },
    }),
  );
  await page.route("**/api/nft/**", (r) => {
    requested = r.request().url();
    return r.fulfill({ status: 503, json: { status: "unavailable" } });
  });
  await page.goto("/#/collection/record-28b708ee");
  await page.getByRole("button", { name: "Play An edition" }).click();
  await expect(
    page.getByRole("button", { name: "Retry An edition" }),
  ).toBeVisible();
  expect(requested).toContain("token=" + token);
  await page.getByText("The edition & collection", { exact: true }).click();
  await expect(page.locator("#collection-items")).toContainText(token);
});

test("recording filters combine, deep-link and clear without leaving stale results", async ({
  page,
}) => {
  await page.goto("/#/records?collection=CHAOS");
  await expect(page.locator(".record-coverage")).toContainText(
    "43 selected works",
  );
  await page.getByLabel("Media", { exact: true }).selectOption("video");
  await expect(page.locator(".nft-grid")).toContainText(
    "No verified work matches",
  );
  await page.reload();
  await expect(page.getByLabel("Collections", { exact: true })).toHaveValue(
    "CHAOS",
  );
  await expect(page.getByLabel("Media", { exact: true })).toHaveValue("video");
  await page.getByRole("link", { name: "Clear filters", exact: true }).click();
  await expect(page.locator(".record-coverage")).toContainText(
    `${nftCatalog.length} selected works`,
  );
  await page.getByLabel("Media", { exact: true }).selectOption("video");
  await expect(page.locator(".nft-card")).not.toHaveCount(0);
  await expect(page.locator(".nft-grid")).not.toContainText("Walls — CHAOS");
});

test("six movements keep evidence optional and CHAOS connected to its recording", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(page.locator(".scroll-sequence")).toHaveCount(6);
  for (const id of ["release", "rooms", "band", "remain"]) {
    const firstBeat = page
      .locator(`#story-${id} .scroll-beat`)
      .nth(id === "release" ? 1 : 0);
    await firstBeat.scrollIntoViewIfNeeded();
    const sceneImage = page.locator(`#story-${id} .scroll-art-image`).first();
    await expect
      .poll(() =>
        sceneImage.evaluate(
          (image) => image.complete && image.naturalWidth > 0,
        ),
      )
      .toBe(true);
    if (info.project.name === "phone")
      await page.screenshot({
        path: `captures/six-movements-${id}-phone-image.png`,
        animations: "disabled",
      });
    const beat = page.locator(`#story-${id} .scroll-beat`).first();
    await beat.scrollIntoViewIfNeeded();
    await expect(page.locator(`#story-${id}`)).toHaveAttribute(
      "data-active-beat",
      "0",
    );
    await expect(beat.locator(".beat-evidence")).not.toHaveAttribute(
      "open",
      "",
    );
    await page.screenshot({
      path: `captures/six-movements-${id}-${info.project.name}.png`,
      animations: "disabled",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
  await page.getByRole("link", { name: "Hear 43 CHAOS songs" }).click();
  await expect(page).toHaveURL(/collection=CHAOS/);
  await expect(page.locator(".nft-card")).toHaveCount(43);
  await page.goBack();
  await expect(
    page.locator(".interlude-band").getByRole("button", { name: /Play Walls/ }),
  ).toBeVisible();
});

test("scene frames follow the story both ways and Catalog names open their evidence", async ({
  page,
}, info) => {
  await page.goto("/");
  const chapter = page.locator("#story-release");
  const catalog = chapter.locator(".film-beat").nth(3);
  await catalog.scrollIntoViewIfNeeded();
  await expect(chapter).toHaveAttribute("data-active-beat", "3");
  await expect(chapter.locator('[data-frame="3"]')).toHaveCSS("opacity", "1");
  await catalog
    .getByRole("link", { name: "Jeremy Stern", exact: true })
    .scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => scrollY);
  await catalog
    .getByRole("link", { name: "Jeremy Stern", exact: true })
    .click();
  await expect(page.locator("#sheet-title")).toHaveText("Jeremy Stern");
  await expect(page.locator("#sheet")).toContainText("Mike McKain");
  await page.keyboard.press("Escape");
  expect(Math.abs((await page.evaluate(() => scrollY)) - before)).toBeLessThan(
    5,
  );
  await page.screenshot({
    path: `captures/cinema-catalog-${info.project.name}.png`,
    animations: "disabled",
  });
  await chapter.locator(".film-beat").nth(1).scrollIntoViewIfNeeded();
  await expect(chapter).toHaveAttribute("data-active-beat", "1");
  await expect(chapter.locator('[data-frame="1"]')).toHaveCSS("opacity", "1");
  await expect(chapter.locator('[data-frame="3"]')).toHaveCSS(
    "visibility",
    "hidden",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(chapter.locator('[data-frame="1"]')).toHaveCSS(
    "transition-duration",
    "0s",
  );
  const band = page.locator("#story-band");
  await band.locator(".film-beat").nth(1).scrollIntoViewIfNeeded();
  await expect(band).toHaveAttribute("data-active-beat", "1");
  await page.screenshot({
    path: `captures/cinema-trio-${info.project.name}.png`,
    animations: "disabled",
  });
});

test("a song leads into its collective experiment and back", async ({
  page,
}, info) => {
  await page.goto("/#/moment/walls");
  const reading = page.getByRole("region", { name: "Inside this experiment" });
  await expect(
    reading.getByRole("heading", { name: "A demo waiting for someone else" }),
  ).toBeVisible();
  await reading
    .getByRole("link", { name: "How the CHAOS experiment worked" })
    .click();
  await expect(page).toHaveURL(/moment\/chaos/);
  const mechanic = page.getByRole("heading", {
    name: "The release became something you did",
  });
  await mechanic.scrollIntoViewIfNeeded();
  await expect(mechanic).toBeVisible();
  await page.screenshot({
    path: `captures/chaos-close-reading-${info.project.name}.png`,
  });
  await page
    .getByRole("region", { name: "Inside this experiment" })
    .getByRole("link", { name: "Read the account" })
    .nth(1)
    .click();
  await expect(page.getByRole("dialog")).toContainText("3 June 2022");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/moment\/walls/);
});
