import { chromium, webkit } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
const base = process.env.VERIFY_BASE_URL || "http://127.0.0.1:4303";
const report = {
  checkedAt: new Date().toISOString(),
  base,
  scope:
    "Isolated candidate only. UI and representative playback; no complete-media or onchain verification claim.",
  checks: [],
  status: "running",
};
mkdirSync("captures", { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const api = await browser.newContext();
  const res = await api.request.get(base + "/api/catalog?view=index", {
    timeout: 60000,
  });
  assert.equal(res.status(), 200);
  const data = await res.json();
  const record = data.records.find(
    (r) => r.id === "spinamp-4130ab5f9ba118dd8bca",
  );
  assert.ok(record);
  report.record = record.id;
  report.counts = data.summary;
  for (const action of ["collectors", "holders", "owner", "recover"]) {
    const r = await api.request.get(base + "/api/" + action + "/" + record.id);
    const p = await r.json();
    assert.equal(r.status(), 200);
    assert.equal(p.scope, "unconfirmed-mint");
    assert.equal(p.status, "unsupported");
    report.checks.push({ case: action + "-unsupported", pass: true });
  }
  const share = await api.request.get(base + "/share/record/" + record.id);
  assert.equal(share.status(), 200);
  assert.ok((await share.text()).includes(record.title));
  report.checks.push({ case: "share-server-metadata", pass: true });
  for (const view of [
    { width: 1440, height: 1000, theme: "light" },
    { width: 1440, height: 1000, theme: "dark" },
    { width: 390, height: 844, theme: "light" },
    { width: 390, height: 844, theme: "dark" },
  ]) {
    const ctx = await browser.newContext({
      viewport: { width: view.width, height: view.height },
    });
    await ctx.addInitScript(
      (theme) => localStorage.setItem("mn-archive-theme", theme),
      view.theme,
    );
    const page = await ctx.newPage();
    const errors = [],
      ownershipCalls = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (
        /\/api\/(collectors|owner|holders|recover)\//.test(r.url()) &&
        r.url().includes(record.id)
      )
        ownershipCalls.push(r.url());
    });
    await page.goto(base + "/#record/" + record.id + "?tab=proof", {
      waitUntil: "domcontentloaded",
    });
    await page
      .getByRole("heading", { name: "Preserved by Spinamp", exact: true })
      .waitFor({ timeout: 60000 });
    assert.equal(
      await page.locator("[data-recover],[data-owner],[data-holders]").count(),
      0,
    );
    assert.equal(await page.locator('a[href*="undefined"]').count(), 0);
    assert.match(
      await page.locator(".record-head .eyebrow").innerText(),
      /Mint unconfirmed/i,
    );
    const text = await page.locator("[role=tabpanel]").innerText();
    assert.match(text, /may be transcoded/);
    assert.doesNotMatch(
      text,
      /Original contract|Token ID|Read the contract again/,
    );
    await page
      .waitForFunction(
        () => {
          const img = document.querySelector(".record-head img");
          return img?.complete && img.naturalWidth > 0;
        },
        null,
        { timeout: 5000 },
      )
      .catch(() => {});
    const artworkLoaded = await page
      .locator(".record-head img")
      .evaluate((img) => img.complete && img.naturalWidth > 0)
      .catch(() => false);
    await page.screenshot({
      path: `captures/indexed-release-${view.width}-${view.theme}.png`,
      fullPage: true,
    });
    const y = await page.evaluate(() => scrollY);
    await page.getByRole("tab", { name: "Collectors", exact: true }).click();
    await page
      .getByRole("heading", { name: "Collectors not yet linked" })
      .waitFor();
    assert.equal(await page.locator(".ownership-tools").count(), 0);
    await page.getByRole("tab", { name: "Details", exact: true }).click();
    await page.getByText("Added to Spinamp index", { exact: false }).waitFor();
    assert.equal(
      await page.locator("[data-royalty-payments],.song-revenue").count(),
      0,
    );
    await page.getByRole("tab", { name: "Comments", exact: true }).click();
    assert.equal(await page.locator(".comment").count(), 0);
    await page.locator('.record-head a[href^="#artist/"]').click();
    await page.locator(".artist-identity").waitFor();
    assert.ok((await page.locator(".record-card").count()) > 0);
    assert.ok(
      (await page.locator(".cover-badge").allTextContents()).some((t) =>
        t.includes("Index only"),
      ),
    );
    await page.goto(base + "/#explore?q=" + encodeURIComponent(record.title), {
      waitUntil: "domcontentloaded",
    });
    await page.locator(".record-card").first().waitFor({ timeout: 60000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    );
    assert.deepEqual(ownershipCalls, []);
    assert.deepEqual(errors, []);
    report.checks.push({
      case: `${view.width}-${view.theme}`,
      pass: true,
      artworkLoaded,
      pageErrors: errors,
      unconfirmedOwnershipCalls: ownershipCalls,
    });
    await ctx.close();
  }
  const guest = await browser.newContext();
  const gp = await guest.newPage();
  await gp.goto(base + "/#playlists");
  await gp.locator("[data-new-playlist]").waitFor({ timeout: 60000 });
  await gp.locator("[data-new-playlist]").click();
  await gp.locator("[name=name]").fill("Index-only listening");
  await gp.getByRole("button", { name: "Save playlist", exact: true }).click();
  await gp.getByRole("heading", { name: "Index-only listening" }).waitFor();
  const playlistHash = await gp.evaluate(() => location.hash);
  await gp.goto(base + "/#record/" + record.id);
  await gp.locator(".record-head [data-add-playlist]").waitFor();
  await gp.locator(".record-head [data-add-playlist]").click();
  await gp
    .locator("[name=existing]")
    .selectOption({ label: "Index-only listening" });
  await gp.getByRole("button", { name: "Add recording", exact: true }).click();
  await gp.goto(base + "/" + playlistHash);
  await gp.locator(".personal-track").waitFor();
  assert.equal(await gp.locator(".personal-track").count(), 1);
  await gp.reload();
  await gp.locator(".personal-track").waitFor();
  assert.ok(
    (await gp.locator(".personal-track").innerText()).includes(record.title),
  );
  report.checks.push({ case: "guest-playlist-create-add-reload", pass: true });
  await guest.close();
  // Existing token route must retain its proof and exact collector affordances.
  const page = await api.newPage();
  await page.goto(base + "/#record/record-69c77ef0?tab=proof");
  await page.locator("[data-recover]").waitFor({ timeout: 60000 });
  assert.ok(
    (await page.locator("[role=tabpanel]").innerText()).includes(
      "Original contract",
    ),
  );
  report.checks.push({ case: "legacy-token-proof", pass: true });
  await api.close();
  report.status = "passed";
} catch (e) {
  report.status = "failed";
  report.error = e.stack;
  process.exitCode = 1;
} finally {
  await browser.close();
  writeFileSync(
    "data/indexed-release-ui-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
