import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
const base =
  process.env.VERIFY_BASE_URL || "https://web3-music-repo.vercel.app";
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const report = {
  checkedAt: new Date().toISOString(),
  base,
  scope:
    "Selected public listening/search/collector/local-playlist flows. Real account and wallet linking not tested.",
  steps: [],
  rendering: [],
  playback: [],
  pageErrors: [],
  failedRequests: [],
  auth: "Production Privy configuration pending; no real sign-in attempted.",
};
let catalogCaptured = false;
p.on("pageerror", (e) => report.pageErrors.push(e.message));
p.on("requestfailed", (r) => {
  if (report.failedRequests.length < 60)
    report.failedRequests.push({ url: r.url(), error: r.failure()?.errorText });
});
p.on("response", async (r) => {
  if (!catalogCaptured && r.url() === base + "/api/catalog") {
    catalogCaptured = true;
    try {
      const d = await r.json();
      report.catalog = {
        status: r.status(),
        records: d.records.length,
        platforms: Object.fromEntries(
          [...new Set(d.records.map((r) => r.platform))].map((s) => [
            s,
            d.records.filter((r) => r.platform === s).length,
          ]),
        ),
        headers: {
          contentType: r.headers()["content-type"],
          encoding: r.headers()["content-encoding"],
        },
      };
    } catch (e) {
      report.catalog = { status: r.status(), error: e.message };
    }
  }
});
const save = () =>
  fs.writeFileSync(
    "data/production-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
async function step(name, fn) {
  try {
    const value = await fn();
    report.steps.push({ name, passed: true, ...value });
    console.log(name, "PASS", JSON.stringify(value));
  } catch (e) {
    report.steps.push({ name, passed: false, error: e.message });
    console.log(name, "FAIL", e.message.split("\n")[0]);
  }
  save();
}
async function go(route) {
  await p.goto(base + "/#" + route, { waitUntil: "domcontentloaded" });
  await p.locator("main h1").first().waitFor({ timeout: 45000 });
}
const tracks = [
  ["sound", "recovered-sound-1-b2cb781aa0b35aec7acef3f9751b61505fd5715a"],
  ["catalog", "catalog-1-0bc2a24ce568dad89691116d5b34deb6c203f342-52"],
  ["mint-songs", "mint-songs-1-2b5426a5b98a3e366230eba9f95a24f09ae4a584-7"],
  ["polygon", "mint-songs-137-c29cbe04ae322469dc077741afa2fbccda748ae4-60000"],
  ["rush", "pete-zora-coin-base-c01f464c55f5b1bec05db5205d2fae9e6a835a5e"],
  ["mija", "recovered-sound-10-1bfc0624b52e870cc00d4e39995c75c7da8763d3"],
];
try {
  await step("initial public render", async () => {
    const start = Date.now();
    await go("home");
    return {
      renderMs: Date.now() - start,
      title: await p.locator("main h1").first().innerText(),
      resources: await p.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .filter((r) => r.name.includes("/api/catalog"))
          .map((r) => ({
            duration: r.duration,
            transferSize: r.transferSize,
            encodedBodySize: r.encodedBodySize,
            decodedBodySize: r.decodedBodySize,
          })),
      ),
    };
  });
  await step("Pete alias search and artist profile", async () => {
    await go("explore");
    await p.locator("#search").fill("p3t3rango");
    await p.waitForFunction(
      () => document.querySelectorAll(".record-card").length === 11,
    );
    const results = await p.locator(".record-card").count();
    await go("artist/pete-rango");
    assert.equal(await p.locator(".record-card").count(), 11);
    return { results, profileRecords: 11 };
  });
  await step("Mint Songs platform and Polygon filter", async () => {
    await go("explore");
    await p.locator("#search").fill("");
    await p.locator("[data-clear-filters]").click();
    await p.locator('[data-filter="Mint Songs"]').click();
    await p.waitForTimeout(300);
    const platformCount = await p.locator(".results").innerText();
    await p.locator('[data-facet="network"]').selectOption("137");
    await p.waitForTimeout(250);
    const polygonCount = await p.locator(".results").innerText();
    assert.ok((await p.locator(".record-card").count()) > 0);
    await p.locator("#search").fill("TAY");
    await p.waitForTimeout(250);
    assert.match(await p.locator("main").innerText(), /SHUT IT OFF/);
    return { platformCount, polygonCount, artistSearch: "TAY → SHUT IT OFF" };
  });
  for (const [name, id] of tracks)
    await step("play " + name, async () => {
      await go("record/" + id);
      await p
        .locator('[data-play="' + id + '"]')
        .first()
        .click();
      let failure = null;
      try {
        await p.waitForFunction(
          () => document.querySelector("#audio")?.currentTime > 1,
          null,
          { timeout: 50000 },
        );
      } catch (e) {
        failure = e.message.split("\n")[0];
      }
      const observed = await p.locator("#audio").evaluate((a) => ({
        time: a.currentTime,
        duration: Number.isFinite(a.duration) ? a.duration : null,
        readyState: a.readyState,
        source: a.currentSrc,
        error: a.error?.message || null,
        status: document.querySelector("#player-source").textContent,
      }));
      report.playback.push({
        name,
        id,
        passed: !failure,
        ...observed,
        failure,
      });
      await p.locator("#audio").evaluate((a) => a.pause());
      assert.equal(failure, null, JSON.stringify(observed));
      return observed;
    });
  await step("local playlist create/add/reorder/reload/play", async () => {
    await go("playlists");
    await p.locator("[data-new-playlist]").click();
    await p.locator("[name=name]").fill("Production recovery QA");
    await p.getByRole("button", { name: "Save playlist", exact: true }).click();
    await p
      .getByRole("heading", { name: "Production recovery QA", exact: true })
      .waitFor();
    const hash = await p.evaluate(() => location.hash);
    for (const id of ["record-69c77ef0", "record-not4me"]) {
      await go("record/" + id);
      await p.locator("[data-add-playlist]").click();
      await p
        .locator("[name=existing]")
        .selectOption({ label: "Production recovery QA" });
      await p
        .getByRole("button", { name: "Add recording", exact: true })
        .click();
    }
    await go(hash.slice(1));
    assert.equal(await p.locator(".personal-track").count(), 2);
    await p.getByRole("button", { name: "Move track 2 up" }).click();
    await p.reload();
    await p.locator(".personal-track").first().waitFor();
    assert.match(
      await p.locator(".personal-track").first().innerText(),
      /NOT4ME/,
    );
    await p.locator("[data-play-personal]").click();
    await p.waitForFunction(
      () => document.querySelector("#audio").currentTime > 1,
      null,
      { timeout: 40000 },
    );
    await p.locator("#audio").evaluate((a) => a.pause());
    await p.screenshot({
      path: "captures/production-playlist.png",
      fullPage: true,
    });
    await p.locator("[data-delete-playlist]").click();
    await p.locator("#confirm-delete").click();
    return {
      tracks: 2,
      reorderedAcrossReload: true,
      playback: true,
      storage: "Browser only; no account API writes",
      cleanup: true,
    };
  });
  await step("collectors and profile images", async () => {
    await go("record/record-69c77ef0?tab=collectors");
    await p
      .locator(".collector-grid .collector-card")
      .first()
      .waitFor({ timeout: 35000 });
    const firstCount = await p
      .locator(".collector-grid .collector-card")
      .count();
    const pfps = await p.locator(".collector-grid img").count();
    assert.ok(pfps > 0);
    let paginated = firstCount;
    const button = p.locator("[data-more-collectors]");
    if (await button.count()) {
      await button.click();
      await p.waitForFunction(
        (n) =>
          document.querySelectorAll(".collector-grid .collector-card").length >
          n,
        firstCount,
        { timeout: 30000 },
      );
      paginated = await p.locator(".collector-grid .collector-card").count();
    }
    await p.locator(".collector-grid .collector-card").first().click();
    await p.locator(".collector-profile").waitFor();
    await p.waitForFunction(
      () => !document.querySelector("#profile-loading"),
      null,
      { timeout: 35000 },
    );
    const profile = await p.locator(".collector-profile").innerText();
    assert.ok((await p.locator(".collector-record").count()) > 0);
    await p.screenshot({
      path: "captures/production-collector-profile.png",
      fullPage: true,
    });
    return {
      initialCollectors: firstCount,
      totalCollectors: paginated,
      pfpElements: pfps,
      profile,
    };
  });
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"])
      for (const [name, route] of [
        ["explore", "explore"],
        ["rush", "record/" + tracks[4][1]],
        ["mint-songs", "record/" + tracks[2][1]],
      ])
        await step(`render ${name} ${width} ${theme}`, async () => {
          await p.setViewportSize({ width, height: 1000 });
          await go(route);
          if (name === "explore") {
            await p.locator("#search").fill("");
            await p.locator("[data-clear-filters]").click();
          }
          await p.evaluate(
            (t) => (document.documentElement.dataset.theme = t),
            theme,
          );
          await p.waitForTimeout(1200);
          const observation = await p.evaluate(() => ({
            overflow: document.documentElement.scrollWidth > innerWidth,
            brokenImages: [...document.querySelectorAll("main img")]
              .filter((i) => i.complete && !i.naturalWidth)
              .map((i) => i.src),
          }));
          const screenshot = `captures/production-${name}-${width}-${theme}.png`;
          await p.screenshot({ path: screenshot, fullPage: true });
          report.rendering.push({
            name,
            width,
            theme,
            ...observation,
            screenshot,
          });
          assert.equal(observation.overflow, false);
          assert.deepEqual(observation.brokenImages, []);
          return { overflow: false, brokenImages: 0 };
        });
} finally {
  report.finishedAt = new Date().toISOString();
  report.passed =
    report.steps.every((s) => s.passed) && report.pageErrors.length === 0;
  save();
  await b.close();
}
