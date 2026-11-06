import { test, expect } from "@playwright/test";

test("deeper chapters retain the documentary position and resolve evidence", async ({
  page,
}, info) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  for (const id of [
    "future-surf",
    "eternal-garden",
    "moonshot",
    "heart-project",
    "black-dave-glass",
    "chill-pill",
    "coop-records",
  ]) {
    const link = page.locator(`.deeper-threads a[href="#/moment/${id}"]`);
    await link.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => scrollY);
    await link.click();
    await expect(page.locator("h1")).toBeVisible();
    await page
      .getByRole("link", { name: "Behind this moment", exact: true })
      .click();
    await expect(page.locator("#sheet")).toBeVisible();
    await expect(page.locator("#sheet-title")).not.toBeEmpty();
    await page.keyboard.press("Escape");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    if (id === "eternal-garden") {
      await expect(page.locator(".scene-image")).toHaveAttribute(
        "src",
        /tk-never-forget/,
      );
      await page.screenshot({
        path: `captures/garden-chapter-${info.project.name}.png`,
        animations: "disabled",
      });
      await expect(
        page.getByRole("button", { name: "Play Never Forget", exact: true }),
      ).toHaveCount(1);
      await expect(
        page.getByRole("button", { name: /Play AL3C Acoustic/ }),
      ).toHaveCount(1);
    }
    await page.goBack();
    await expect(page.locator(".film")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => scrollY))
      .toBeGreaterThan(before - 8);
    expect(
      Math.abs((await page.evaluate(() => scrollY)) - before),
    ).toBeLessThan(8);
  }
  expect(errors).toEqual([]);
});

test("artist alias search preserves historical recording credits", async ({
  page,
}) => {
  await page.goto("/#/records?q=Lackhoney");
  await expect(
    page.locator(".nft-card").filter({ hasText: "MIAMI FREESTYLE" }),
  ).toHaveCount(1);
  await expect(
    page.locator(".nft-card").filter({ hasText: "MIAMI FREESTYLE" }),
  ).toContainText("Aly");
  await page.goto("/#/explore?view=people&q=Aly");
  // Directory search has its own input; use it to exercise live filtering.
  const search = page.locator('input[type="search"]');
  await search.fill("Aly");
  await search.dispatchEvent("input");
  await page.getByRole("link", { name: /Lackhoney/ }).click();
  await expect(page.locator("#sheet")).toContainText("Also credited as Aly");
});

test("The Park chapter connects its explanation to playable records and the wider archive", async ({
  page,
}) => {
  await page.goto("/#/moment/the-park");
  await expect(
    page.getByRole("heading", { name: "A scene needs a place to return." }),
  ).toBeVisible();
  await expect(page.locator(".nft-card")).toHaveCount(3);
  await page.locator("[data-queue]").first().click();
  await expect(
    page.getByRole("region", { name: "Collection player" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Explore The Park’s recordings", exact: true })
    .click();
  await expect(page.locator(".nft-card")).toHaveCount(29);
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "A scene needs a place to return." }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Collection player" }),
  ).toBeVisible();
});
