import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";

const base = process.env.ARCHIVE_QA_URL || "http://127.0.0.1:4191";
const wallet = "0x" + "a".repeat(40);
const keys = {
  explore: "mn-archive-explore-filters-v1",
  collection: "mn-archive-collection-filters-v1",
};
const defaults = {
  platform: "All",
  network: "",
  media: "",
  collection: "",
  sort: "archive",
};
const query = "filter-preference-private-query";
const report = {
  checkedAt: new Date().toISOString(),
  base,
  scope:
    "Actual app UI and catalog; deterministic public wallet/profile API fixtures isolate filter behavior. No sign-in, account write, real ownership assertion, or audio playback.",
  cases: [],
};
const browser = await chromium.launch();
async function fields(p, scope) {
  return p.evaluate((scope) => {
    const attr = scope === "explore" ? "data-facet" : "data-wallet-filter";
    const value = (name) =>
      document.querySelector(`[${attr}="${name}"]`)?.value;
    return {
      platform:
        scope === "explore"
          ? document.querySelector('[data-filter][aria-pressed="true"]')
              ?.dataset.filter
          : value("platform"),
      network: value("network"),
      media: value("media"),
      collection: value("collection"),
      sort: value("sort"),
    };
  }, scope);
}
async function saved(p, scope) {
  return p.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, keys[scope]);
}
async function assertPrivate(p) {
  const snapshots = await p.evaluate(
    (keys) =>
      Object.fromEntries(
        Object.entries(keys).map(([s, k]) => [s, localStorage.getItem(k)]),
      ),
    keys,
  );
  for (const raw of Object.values(snapshots)) {
    if (!raw) continue;
    const d = JSON.parse(raw);
    assert.equal(d.version, 1);
    assert.deepEqual(Object.keys(d.values).sort(), [
      "collection",
      "media",
      "network",
      "platform",
      "sort",
    ]);
    assert.ok(!raw.includes(wallet));
    assert.ok(!raw.includes(query));
    assert.ok(!raw.includes("myCollectionOnly"));
  }
  return snapshots;
}
async function ready(p, scope) {
  await p
    .locator(
      scope === "explore"
        ? '[data-facet="sort"]'
        : '[data-wallet-filter="sort"]',
    )
    .waitFor();
}
async function capture(p, scope, width, theme) {
  if (scope === "collection")
    await p.waitForFunction(() =>
      document
        .querySelector('[data-wallet-network="1"]')
        ?.textContent.includes("2 token entries checked"),
    );
  await p.evaluate(async () => {
    await document.fonts.ready;
  });
  const controls = p.locator(
    scope === "explore"
      ? ".filter-toolbar"
      : '[data-wallet-filter="collection"]',
  );
  await controls
    .first()
    .evaluate((el) => el.scrollIntoView({ block: "center" }));
  await p.screenshot({
    path: `captures/filter-preferences-${scope}-${width}-${theme}.png`,
  });
  assert.ok(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  assert.equal(
    await p.evaluate(() => document.documentElement.dataset.theme),
    theme,
  );
}
try {
  for (const [width, theme] of [
    [1440, "dark"],
    [390, "light"],
  ]) {
    const p = await browser.newPage({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      isMobile: width === 390,
      hasTouch: width === 390,
    });
    const result = { width, theme, errors: [] };
    report.cases.push(result);
    p.on("pageerror", (e) => result.errors.push(e.message));
    await p.addInitScript((theme) => {
      try {
        localStorage.setItem("mn-archive-theme", theme);
      } catch {}
    }, theme);
    await p.route("**/api/auth/config", (r) =>
      r.fulfill({ json: { enabled: false } }),
    );
    await p.route("**/api/collector-search?*", (r) =>
      r.fulfill({ json: { status: "ok", items: [] } }),
    );
    await p.route(/\/api\/collector\/0x[a-f0-9]{40}$/, (r) =>
      r.fulfill({
        json: {
          address: wallet,
          name: "Filter verification wallet",
          ens: { status: "not-configured" },
          observedHoldings: [],
          snapshotHoldings: [],
          comments: [],
        },
      }),
    );
    await p.route("**/api/collector/0x*/collection?*", (r) =>
      r.fulfill({
        json: {
          status: "indexed",
          scope: "spinamp-wallet-index",
          indexFreshness: "unknown",
          items: [],
          loadedNfts: 0,
          totalIndexedNfts: 0,
          nextCursor: null,
          checkedAt: report.checkedAt,
        },
      }),
    );
    await p.route("**/api/wallet/0x*", (r) => {
      const chain = new URL(r.request().url()).searchParams.get("chainId");
      const ids =
        chain === "1"
          ? ["record-69c77ef0", "record-1956ba25"]
          : chain === "8453"
            ? ["spinamp-073e25367a01a4e53532"]
            : [];
      return r.fulfill({
        json: {
          status: "indexed",
          chainId: Number(chain),
          address: wallet,
          items: ids.map((recordId, index) => ({
            recordId,
            balance: "1",
            contract: wallet,
            tokenId: String(index + 1),
          })),
          nextCursor: null,
          checkedAt: report.checkedAt,
        },
      });
    });
    await p.goto(base + "/#explore");
    await ready(p, "explore");
    assert.deepEqual(await fields(p, "explore"), defaults);
    const collection = await p
      .locator('[data-facet="collection"] option')
      .evaluateAll(
        (options) =>
          options.find((o) => o.value.startsWith("MIAMI FREESTYLE"))?.value,
      );
    assert.ok(collection);
    const explore = {
      platform: "Sound",
      network: "1",
      media: "audio",
      collection,
      sort: "oldest",
    };
    await p.locator('[data-filter="Sound"]').click();
    for (const k of ["network", "media", "collection", "sort"])
      await p.locator(`[data-facet="${k}"]`).selectOption(explore[k]);
    await p.locator("#search").fill(query);
    await p.locator("[data-owned-filter]").click();
    assert.equal(
      await p.locator("[data-owned-filter]").getAttribute("aria-pressed"),
      "true",
    );
    assert.deepEqual((await saved(p, "explore")).values, explore);
    await assertPrivate(p);
    await p.reload();
    await ready(p, "explore");
    assert.deepEqual(await fields(p, "explore"), explore);
    assert.equal(await p.locator("#search").inputValue(), "");
    assert.equal(
      await p.locator("[data-owned-filter]").getAttribute("aria-pressed"),
      "false",
    );
    await capture(p, "explore", width, theme);
    result.exploreRestored = explore;
    result.queryAndOwnedScopeNotRestored = true;
    await p.goto(base + "/#collector/" + wallet);
    await ready(p, "collection");
    assert.deepEqual(await fields(p, "collection"), {
      ...defaults,
      platform: "",
    });
    await p.waitForFunction(() =>
      [
        ...document.querySelectorAll(
          '[data-wallet-filter="collection"] option',
        ),
      ].some((o) => o.value === "Consent"),
    );
    const collectionPrefs = {
      platform: "Sound",
      network: "1",
      media: "audio",
      collection: "Consent",
      sort: "newest",
    };
    for (const k of Object.keys(collectionPrefs))
      await p
        .locator(`[data-wallet-filter="${k}"]`)
        .selectOption(collectionPrefs[k]);
    await p.locator('[data-wallet-filter="query"]').fill(query);
    assert.deepEqual((await saved(p, "collection")).values, collectionPrefs);
    assert.deepEqual((await saved(p, "explore")).values, explore);
    await assertPrivate(p);
    await p.reload();
    await ready(p, "collection");
    assert.deepEqual(await fields(p, "collection"), collectionPrefs);
    assert.equal(
      await p.locator('[data-wallet-filter="query"]').inputValue(),
      "",
    );
    await capture(p, "collection", width, theme);
    result.collectionRestored = collectionPrefs;
    await p.goto(base + "/#explore");
    await ready(p, "explore");
    assert.deepEqual(await fields(p, "explore"), explore);
    await p.locator("[data-clear-filters]").click();
    assert.equal(await saved(p, "explore"), null);
    assert.deepEqual(await fields(p, "explore"), defaults);
    assert.deepEqual((await saved(p, "collection")).values, collectionPrefs);
    await p.reload();
    await ready(p, "explore");
    assert.deepEqual(await fields(p, "explore"), defaults);
    assert.equal(await saved(p, "explore"), null);
    await p.goto(base + "/#collector/" + wallet);
    await ready(p, "collection");
    assert.deepEqual(await fields(p, "collection"), collectionPrefs);
    await p.locator("[data-wallet-reset-filters]").click();
    assert.equal(await saved(p, "collection"), null);
    assert.deepEqual(await fields(p, "collection"), {
      ...defaults,
      platform: "",
    });
    await p.reload();
    await ready(p, "collection");
    assert.deepEqual(await fields(p, "collection"), {
      ...defaults,
      platform: "",
    });
    assert.equal(await saved(p, "collection"), null);
    assert.equal(await saved(p, "explore"), null);
    result.scopesIndependent = true;
    result.resetReloadDefaults = true;
    result.onlyApprovedFacetFieldsStored = true;
    result.queryAndWalletExcluded = true;
    assert.deepEqual(result.errors, []);
    await p.close();
  }
  writeFileSync(
    "data/filter-preferences-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
