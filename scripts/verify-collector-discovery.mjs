import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.ARCHIVE_QA_URL || "http://127.0.0.1:4191";
const a = "0x" + "a".repeat(40),
  b = "0x" + "b".repeat(40);
const miami = "record-69c77ef0",
  video = "spinamp-073e25367a01a4e53532";
const report = {
  checkedAt: new Date().toISOString(),
  base,
  scope:
    "Actual app UI with deterministic public identity/wallet API fixtures; not real-account or current ownership verification.",
  cases: [],
};
const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    const p = await browser.newPage({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      isMobile: width === 390,
      hasTouch: width === 390,
    });
    const c = { width, errors: [], walletCalls: [] };
    report.cases.push(c);
    p.on("pageerror", (e) => c.errors.push(e.message));
    await p.route("**/api/auth/config", (r) =>
      r.fulfill({ json: { enabled: false } }),
    );
    await p.route("**/api/collector-search?*", (r) => {
      const q = new URL(r.request().url()).searchParams.get("q");
      return r.fulfill({
        json:
          q === "failure"
            ? { status: "unavailable", query: q, items: [] }
            : {
                status: "ok",
                query: q,
                items: [a, b].map((address, i) => ({
                  address,
                  name: "Pete Collector",
                  sourceType: "historical-sound",
                  capturedAt: "2023-05-01",
                  avatarURL: i ? null : "/people/campfire-160.webp",
                })),
                ...(q === "pete.eth"
                  ? { ens: { status: "resolved", name: q, address: a } }
                  : {}),
              },
      });
    });
    await p.route("**/api/collector/0x*", (r) =>
      r.fulfill({
        json: {
          address: r.request().url().split("/").pop(),
          name: "Pete Collector",
          avatarURL: "/people/campfire-160.webp",
          avatarSource: "Historical fixture profile",
          ens: { status: "not-configured" },
          archived: {
            name: "Pete Collector",
            capturedAt: "2023-05-01",
            source:
              "https://web.archive.org/web/20230501061119/https://www.sound.xyz/",
          },
          observedHoldings: [],
          comments: [],
        },
      }),
    );
    let snapshotPages = 0;
    const cursors = [];
    await p.route("**/api/collector/0x*/collection?*", async (r) => {
      snapshotPages++;
      const cursor = new URL(r.request().url()).searchParams.get("cursor");
      cursors.push(cursor);
      const next = !!cursor;
      if (snapshotPages === 2)
        return r.fulfill({
          status: 503,
          json: {
            status: "unavailable",
            message: "Fixture snapshot page unavailable",
          },
        });
      if (snapshotPages === 3)
        await new Promise((resolve) => setTimeout(resolve, 300));
      return r.fulfill({
        json: {
          status: "indexed",
          scope: "spinamp-wallet-index",
          indexFreshness: "unknown",
          items: [{ recordId: next ? video : "record-not4me" }],
          nextCursor: next ? null : "page-two",
          checkedAt: report.checkedAt,
        },
      });
    });
    await p.route("**/api/wallet/0x*", (r) => {
      const u = new URL(r.request().url()),
        chain = u.searchParams.get("chainId"),
        id = chain === "1" ? miami : chain === "8453" ? video : null;
      c.walletCalls.push({ address: u.pathname.split("/").pop(), chain });
      return r.fulfill({
        json: {
          status: "indexed",
          items: id ? [{ recordId: id, contract: a, tokenId: "1" }] : [],
          nextCursor: null,
          checkedAt: report.checkedAt,
        },
      });
    });
    await p.goto(base + "/#explore");
    await p.locator("#search").fill("Pete");
    await p.waitForFunction(
      () =>
        document.querySelectorAll("[data-collector-search-result]").length ===
        2,
    );
    await p.locator("#search").press("Enter");
    assert.ok(p.url().endsWith("#explore"));
    for (const theme of ["light", "dark"]) {
      await p.evaluate(
        (t) => (document.documentElement.dataset.theme = t),
        theme,
      );
      await p.screenshot({
        path: `captures/collector-search-${width}-${theme}.png`,
      });
    }
    await p
      .locator(`[data-collector-search-result][href="#collector/${a}"]`)
      .click();
    await p.waitForFunction(
      () =>
        document.querySelectorAll("[data-wallet-matches] .record-card")
          .length === 2,
    );
    await p.waitForFunction(
      () =>
        document.querySelectorAll("[data-wallet-snapshot] .record-card")
          .length === 1,
    );
    assert.equal(snapshotPages, 1);
    await p.locator("[data-wallet-snapshot-page]").click();
    await p
      .getByText("Fixture snapshot page unavailable", { exact: true })
      .waitFor();
    assert.equal(
      await p.locator("[data-wallet-snapshot] .record-card").count(),
      1,
    );
    await p.locator("[data-wallet-snapshot-page]").click();
    await p.locator('[data-wallet-filter="query"]').fill("NOT4ME");
    await p.waitForFunction(
      () => !document.querySelector('[data-wallet-snapshot] [role="status"]'),
    );
    assert.equal(
      await p.evaluate(() => document.activeElement?.dataset.walletFilter),
      "query",
    );
    assert.equal(
      await p.locator('[data-wallet-filter="query"]').inputValue(),
      "NOT4ME",
    );
    c.snapshotArrivalPreservesFilterFocus = true;
    await p.locator("[data-wallet-reset-filters]").click();
    await p.waitForFunction(
      () =>
        document.querySelectorAll("[data-wallet-snapshot] .record-card")
          .length === 2,
    );
    assert.equal(snapshotPages, 3);
    assert.deepEqual(cursors, [null, "page-two", "page-two"]);
    c.snapshotRetryRetainsPreviousPage = true;
    await p
      .getByText("Ownership freshness is unknown", { exact: false })
      .waitFor();
    c.snapshotFirstPageAutomaticFurtherPagesExplicit = true;
    assert.equal(await p.locator("#wallet-lookup").count(), 0);
    assert.equal(
      await p
        .getByRole("heading", { name: "Collected music", exact: true })
        .count(),
      1,
    );
    await p.locator('[data-wallet-filter="media"]').selectOption("video");
    assert.equal(
      await p.locator("[data-wallet-matches] .record-card").count(),
      1,
    );
    assert.equal(
      await p.locator("[data-wallet-snapshot] .record-card").count(),
      1,
    );
    await p.locator("[data-wallet-reset-filters]").click();
    await p.locator('[data-wallet-filter="query"]').fill("MIAMI");
    assert.equal(
      await p.locator("[data-wallet-matches] .record-card").count(),
      1,
    );
    await p.locator("[data-wallet-reset-filters]").click();
    for (const theme of ["light", "dark"]) {
      await p.evaluate((t) => {
        document.documentElement.dataset.theme = t;
        scrollTo(0, 0);
      }, theme);
      await p.screenshot({
        path: `captures/collector-profile-${width}-${theme}.png`,
      });
      await p
        .locator('[data-wallet-filter="query"]')
        .evaluate((el) =>
          scrollTo(0, el.getBoundingClientRect().top + scrollY - 110),
        );
      await p.screenshot({
        path: `captures/collector-collection-${width}-${theme}.png`,
      });
      await p
        .locator("[data-wallet-snapshot]")
        .evaluate((el) =>
          scrollTo(0, el.getBoundingClientRect().top + scrollY - 110),
        );
      await p.screenshot({
        path: `captures/collector-snapshot-${width}-${theme}.png`,
      });
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
    }
    c.filteredPublicCollection = true;
    c.ambiguousNamesRequireSelection = true;
    await p.locator("#search").fill("pete.eth");
    await p.locator("#search").press("Enter");
    await p.waitForURL("**/#collector/" + a);
    c.ensExactNavigation = true;
    await p.locator("#search").fill(b);
    await p.locator("#search").press("Enter");
    await p.waitForURL("**/#collector/" + b);
    c.walletExactNavigation = true;
    await p.locator("#search").fill("failure");
    await p
      .getByText("Collector search is temporarily unavailable.", {
        exact: false,
      })
      .waitFor();
    c.failureHonest = true;
    assert.deepEqual(c.errors, []);
    c.passed = true;
    await p.close();
  }
  report.passed = report.cases.every((c) => c.passed);
} catch (error) {
  report.error = error.stack;
  report.passed = false;
  throw error;
} finally {
  await browser.close();
  writeFileSync(
    "data/collector-discovery-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
