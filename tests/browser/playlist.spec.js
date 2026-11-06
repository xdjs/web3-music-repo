import { nftCatalog } from "../../src/nft-catalog.js";
import { test, expect } from "@playwright/test";
const wav = Buffer.alloc(44 + 16000);
wav.write("RIFF");
wav.writeUInt32LE(wav.length - 8, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24);
wav.writeUInt32LE(16000, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(16000, 40);
test("collection queue persists through navigation and supports playback, skip, shuffle and stop", async ({
  page,
}) => {
  let reads = 0;
  await page.route("**/api/nft/**", (r) => {
    reads++;
    return r.fulfill({
      json: {
        status: "live",
        mediaURL: "https://ipfs.filebase.io/ipfs/test/queue.wav",
      },
    });
  });
  await page.route("https://ipfs.filebase.io/ipfs/test/queue.wav", (r) =>
    r.fulfill({ body: wav, contentType: "audio/wav" }),
  );
  await page.goto("/");
  expect(reads).toBe(0);
  await page
    .getByRole("button", { name: "Play the collection", exact: true })
    .click();
  const player = page.getByRole("region", { name: "Collection player" });
  await expect(player).toBeVisible();
  await expect(player.locator(".playlist-screen audio")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Pause collection", exact: true })
    .click();
  await expect
    .poll(() =>
      player.locator(".playlist-screen audio").evaluate((m) => m.paused),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Show queue", exact: true }).click();
  await expect(player.locator(".playlist-queue li")).toHaveCount(
    nftCatalog.length,
  );
  const current = await player.locator('[aria-current="true"]').textContent();
  await page
    .getByRole("button", { name: "Shuffle queue", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Shuffle queue" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(await player.locator('[aria-current="true"]').textContent()).toBe(
    current,
  );
  await page
    .getByRole("button", { name: "Collapse queue", exact: true })
    .click();
  await page.getByRole("link", { name: "Recordings", exact: true }).click();
  await expect(player).toBeVisible();
  await page
    .getByRole("button", { name: "Next recording", exact: true })
    .click();
  await expect.poll(() => reads).toBeGreaterThan(1);
  await page
    .getByRole("button", { name: "Stop and close player", exact: true })
    .click();
  await expect(player).toBeHidden();
  await expect(player.locator("audio,video")).toHaveCount(0);
});
test("queue advances at the end and bounds consecutive failed recordings", async ({
  page,
}) => {
  let reads = 0;
  await page.route("**/api/nft/**", (r) => {
    reads++;
    return r.fulfill({
      json: {
        status: "live",
        mediaURL: "https://ipfs.filebase.io/ipfs/test/queue.wav",
      },
    });
  });
  await page.route("https://ipfs.filebase.io/ipfs/test/queue.wav", (r) =>
    r.fulfill({ body: wav, contentType: "audio/wav" }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Play the collection", exact: true })
    .click();
  await expect(page.locator(".player-track strong")).toHaveText("INTRO");
  await page.getByRole("button", { name: "Stop and close player" }).click();
  await page.unroute("**/api/nft/**");
  reads = 0;
  await page.route("**/api/nft/**", (r) => {
    reads++;
    return r.fulfill({ status: 503, json: { status: "unavailable" } });
  });
  await page
    .getByRole("button", { name: "Play the collection", exact: true })
    .click();
  await expect(page.locator('.player-track [role="status"]')).toContainText(
    "Playback stopped",
    { timeout: 10000 },
  );
  expect(reads).toBe(3);
});

test("next recording buffers silently and promotes the same element without another lookup", async ({
  page,
}) => {
  const lookups = [];
  const longer = Buffer.alloc(44 + 16000 * 30);
  wav.copy(longer, 0, 0, 44);
  longer.writeUInt32LE(longer.length - 8, 4);
  longer.writeUInt32LE(longer.length - 44, 40);
  await page.route("**/api/nft/**", (r) => {
    lookups.push(r.request().url().split("/").pop());
    return r.fulfill({
      json: {
        status: "live",
        mediaURL: "https://ipfs.filebase.io/ipfs/test/long.wav",
      },
    });
  });
  await page.route("https://ipfs.filebase.io/ipfs/test/long.wav", (r) =>
    r.fulfill({ body: longer, contentType: "audio/wav" }),
  );
  await page.goto("/");
  expect(lookups).toHaveLength(0);
  await page
    .getByRole("button", { name: "Play the collection", exact: true })
    .click();
  await expect(page.locator(".playlist-preload")).toHaveCount(1);
  await expect
    .poll(() => page.locator(".playlist-preload").evaluate((m) => m.readyState))
    .toBeGreaterThan(1);
  expect(
    await page.locator(".playlist-preload").evaluate((m) => m.paused),
  ).toBe(true);
  await page
    .locator(".playlist-preload")
    .evaluate((m) => (m.dataset.testBuffered = "yes"));
  expect(lookups).toHaveLength(2);
  const next = lookups[1];
  await page
    .getByRole("button", { name: "Next recording", exact: true })
    .click();
  await expect(page.locator(".playlist-screen audio")).toHaveAttribute(
    "data-test-buffered",
    "yes",
  );
  expect(lookups.filter((id) => id === next)).toHaveLength(1);
  await page
    .getByRole("button", { name: "Stop and close player", exact: true })
    .click();
  await expect(
    page.locator(".collection-player audio,.collection-player video"),
  ).toHaveCount(0);
});

test("manual queue is silent until play and adding another song preserves the current selection", async ({
  page,
}) => {
  let reads = 0;
  await page.route("**/api/nft/**", (route) => {
    reads++;
    return route.fulfill({
      json: {
        status: "live",
        mediaURL: "https://ipfs.filebase.io/ipfs/test/queue.wav",
      },
    });
  });
  await page.route("https://ipfs.filebase.io/ipfs/test/queue.wav", (route) =>
    route.fulfill({ body: wav, contentType: "audio/wav" }),
  );
  await page.goto("/#/records");
  const adds = page.locator("[data-queue]");
  await adds.nth(0).click();
  const player = page.getByRole("region", { name: "Collection player" });
  await expect(player).toBeVisible();
  expect(reads).toBe(0);
  const title = await player.locator(".player-track strong").textContent();
  await adds.nth(1).click();
  await adds.nth(1).click();
  await expect(player.locator(".player-track strong")).toHaveText(title);
  await player.getByRole("button", { name: "Show queue", exact: true }).click();
  await expect(player.locator(".playlist-queue li")).toHaveCount(2);
  await player
    .getByRole("button", { name: "Play collection", exact: true })
    .click();
  await expect(player.locator(".playlist-screen audio")).toHaveCount(1);
  await page.screenshot({
    path: `captures/manual-queue-${test.info().project.name}.png`,
  });
});

test("The Park recordings filter by original chain and retain queue actions", async ({
  page,
}) => {
  await page.goto("/#/records?q=The%20Park");
  await expect(page.locator(".nft-card")).not.toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Chains", exact: true })
    .selectOption("8453");
  await expect(page.locator(".nft-card").first()).toBeVisible();
  await page
    .locator(".nft-card")
    .first()
    .getByText("The edition & collection", { exact: true })
    .click();
  await expect(page.locator(".nft-card").first()).toContainText("Base · Token");
  await page.locator("[data-queue]").first().click();
  await expect(
    page.getByRole("region", { name: "Collection player" }),
  ).toBeVisible();
  await page.screenshot({
    path: `captures/park-library-${test.info().project.name}.png`,
  });
});

test("an IPFS gateway failure retries the same content address without skipping the song", async ({
  page,
}) => {
  const primary = "https://ipfs.filebase.io/ipfs/bafytest/recovery.wav";
  const alternate = "https://gateway.pinata.cloud/ipfs/bafytest/recovery.wav";
  let retries = 0;
  await page.route("**/api/nft/**", (r) =>
    r.fulfill({ json: { status: "live", mediaURL: primary } }),
  );
  await page.route(primary, (r) => r.abort());
  await page.route(alternate, (r) => {
    retries++;
    return r.fulfill({ body: wav, contentType: "audio/wav" });
  });
  await page.goto("/#/records?q=Felly");
  await page.locator("[data-queue]").first().click();
  await page
    .getByRole("button", { name: "Play collection", exact: true })
    .click();
  await expect.poll(() => retries).toBeGreaterThan(0);
  await expect(page.locator(".playlist-screen audio")).toHaveAttribute(
    "src",
    alternate,
  );
  await expect
    .poll(() =>
      page.locator(".playlist-screen audio").evaluate((m) => m.readyState),
    )
    .toBeGreaterThan(1);
});

test("collection editions queue independently and preserve uint256 token IDs", async ({
  page,
}) => {
  const token = "1361129467683753853853498429727072845879";
  await page.route("**/api/collection/**", (r) =>
    r.fulfill({
      json: {
        status: "indexed",
        items: [{ tokenId: token, title: "Another edition", imageURL: null }],
        nextCursor: null,
      },
    }),
  );
  let requested = "";
  await page.route("**/api/nft/**", (r) => {
    requested = r.request().url();
    return r.fulfill({
      json: {
        status: "live",
        mediaURL: "https://ipfs.filebase.io/ipfs/test/queue.wav",
      },
    });
  });
  await page.route("https://ipfs.filebase.io/ipfs/test/queue.wav", (r) =>
    r.fulfill({ body: wav, contentType: "audio/wav" }),
  );
  await page.goto("/#/collection/record-chaos-walls");
  await page
    .getByRole("button", { name: "Add Another edition to queue", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Play collection", exact: true })
    .click();
  await expect.poll(() => requested).toContain("token=" + token);
  await expect(page.locator(".player-track strong")).toHaveText(
    "Another edition",
  );
});
