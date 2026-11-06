import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.ARCHIVE_QA_URL || "http://127.0.0.1:4191",
  address = "0x" + "a".repeat(40),
  miami = "record-69c77ef0";
const browser = await chromium.launch(),
  report = {
    checkedAt: new Date().toISOString(),
    base,
    scope:
      "Actual collection DOM and native image with delayed wallet-index fixture; no current ownership claim.",
    cases: [],
  };
try {
  for (const width of [1440, 390]) {
    const p = await browser.newPage({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      isMobile: width === 390,
      hasTouch: width === 390,
    });
    const c = { width, errors: [] };
    report.cases.push(c);
    p.on("pageerror", (e) => c.errors.push(e.message));
    let artworkRequests = 0;
    p.on("request", (r) => {
      if (r.url().endsWith("/media/record-69c77ef0-1500.webp"))
        artworkRequests++;
    });
    let release;
    const delayed = new Promise((resolve) => (release = resolve));
    const fetched = await (
      await p.request.get(base + "/api/catalog?view=index")
    ).json();
    const ids = fetched.records
      .filter((r) => r.id !== miami)
      .slice(0, 20)
      .map((r) => r.id);
    await p.route("**/api/auth/config", (r) =>
      r.fulfill({ json: { enabled: false } }),
    );
    await p.route("**/api/collector/0x*", (r) =>
      r.fulfill({
        json: {
          address,
          name: "Collection render fixture",
          ens: { status: "not-configured" },
          observedHoldings: [],
          comments: [],
        },
      }),
    );
    await p.route("**/api/collector/0x*/collection?*", (r) =>
      r.fulfill({
        json: {
          status: "indexed",
          items: [{ recordId: miami }, { recordId: "record-not4me" }],
          nextCursor: null,
          loadedNfts: 2,
          totalIndexedNfts: 2,
        },
      }),
    );
    await p.route("**/api/wallet/0x*", async (r) => {
      const chain = new URL(r.request().url()).searchParams.get("chainId");
      if (chain === "1") await delayed;
      await r.fulfill({
        json: {
          status: "indexed",
          items:
            chain === "1"
              ? ids.map((recordId, i) => ({
                  recordId,
                  contract: address,
                  tokenId: String(i + 1),
                }))
              : [],
          nextCursor: null,
        },
      });
    });
    await p.addInitScript(
      (id) => localStorage.setItem("mn-archive-likes", JSON.stringify([id])),
      miami,
    );
    await p.goto(base + "/#collector/" + address);
    await p.waitForFunction(
      () =>
        document.querySelectorAll("[data-wallet-snapshot] .record-card")
          .length === 2,
    );
    await p
      .locator("[data-wallet-snapshot]")
      .evaluate((el) =>
        scrollTo(0, el.getBoundingClientRect().top + scrollY - 110),
      );
    await p.waitForFunction(
      () =>
        document.querySelector(
          '[data-wallet-snapshot] img[src="/media/record-69c77ef0-1500.webp"]',
        )?.complete &&
        document.querySelector(
          '[data-wallet-snapshot] img[src="/media/record-69c77ef0-1500.webp"]',
        )?.naturalWidth > 0,
    );
    await p
      .locator("[data-wallet-snapshot]")
      .evaluate((el) =>
        scrollTo(0, el.getBoundingClientRect().top + scrollY - 110),
      );
    await p
      .locator('[data-wallet-snapshot] [data-play="record-not4me"]')
      .click();
    await p.waitForFunction(
      () =>
        document.querySelector(
          '[data-wallet-snapshot] [data-play="record-not4me"]',
        )?.dataset.playbackAction === "pause",
    );
    c.before = await p.evaluate((id) => {
      const card = document
        .querySelector(`[data-wallet-snapshot] [data-play="${id}"]`)
        .closest(".record-card");
      window.__retainedCard = card;
      window.__retainedPlayButton = document.querySelector(
        '[data-wallet-snapshot] [data-play="record-not4me"]',
      );
      window.__retainedImage = card.querySelector("img");
      window.__retainedImageLoads = 0;
      window.__retainedImage.addEventListener(
        "load",
        () => window.__retainedImageLoads++,
      );
      return {
        top: card.getBoundingClientRect().top,
        imageWidth: window.__retainedImage.naturalWidth,
        src: window.__retainedImage.src,
      };
    }, miami);
    c.before.artworkRequests = artworkRequests;
    release();
    await p.waitForFunction(
      () =>
        document.querySelectorAll("[data-wallet-matches] .record-card")
          .length === 20,
    );
    c.after = await p.evaluate((id) => {
      const card = document
        .querySelector(`[data-wallet-snapshot] [data-play="${id}"]`)
        .closest(".record-card");
      return {
        sameCard: card === window.__retainedCard,
        liked: card.querySelector("[data-like]").classList.contains("active"),
        samePlayButton:
          document.querySelector(
            '[data-wallet-snapshot] [data-play="record-not4me"]',
          ) === window.__retainedPlayButton,
        playAction: window.__retainedPlayButton.dataset.playbackAction,
        sameImage: card.querySelector("img") === window.__retainedImage,
        top: card.getBoundingClientRect().top,
        imageWidth: card.querySelector("img").naturalWidth,
        extraLoads: window.__retainedImageLoads,
      };
    }, miami);
    c.after.artworkRequests = artworkRequests;
    assert.equal(c.after.artworkRequests, c.before.artworkRequests);
    assert.equal(c.after.sameCard, true);
    assert.equal(c.after.liked, true);
    assert.equal(c.after.samePlayButton, true);
    assert.equal(c.after.playAction, "pause");
    await p
      .locator('[data-wallet-snapshot] [data-play="record-not4me"]')
      .click();
    assert.equal(c.after.sameImage, true);
    assert.equal(c.after.extraLoads, 0);
    assert.equal(c.after.imageWidth, 1500);
    assert.ok(Math.abs(c.after.top - c.before.top) < 2);
    const matches = await p
      .locator("[data-wallet-matches] h3 a")
      .evaluateAll((ns) => ns.map((n) => n.getAttribute("href")));
    assert.equal(new Set(matches).size, 20);
    for (const theme of ["light", "dark"]) {
      await p.evaluate(
        (t) => (document.documentElement.dataset.theme = t),
        theme,
      );
      await p.screenshot({
        path: `captures/collection-render-${width}-${theme}.png`,
      });
    }
    assert.deepEqual(c.errors, []);
    c.passed = true;
    await p.close();
  }
  report.passed = true;
} catch (e) {
  report.error = e.stack;
  report.passed = false;
  throw e;
} finally {
  await browser.close();
  writeFileSync(
    "data/collection-render-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
