import { build } from "esbuild";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.BASE_URL || "http://127.0.0.1:4191";
const mock = `import React,{createContext,useContext,useState,useEffect}from'react';const C=createContext(null);export function PrivyProvider({children}){const[user,setUser]=useState(JSON.parse(localStorage.getItem('qa-user')||'null'));useEffect(()=>{window.__setUser=value=>{localStorage.setItem('qa-user',JSON.stringify(value));setUser(value)}},[]);return <C.Provider value={{user,setUser}}>{children}</C.Provider>}export function usePrivy(){const{user}=useContext(C);return{ready:true,authenticated:!!user,user,logout:()=>window.__setUser(null),getAccessToken:async()=>user?'fixture-'+user.id:null}}export function useLogin(){return{login:()=>window.__setUser({id:'A',linkedAccounts:[]})}}export function useWallets(){return{wallets:[]}}export function useLinkAccount(){return{linkWallet:()=>{}}}export function useConnectWallet(){return{connectWallet:()=>{}}}`;
const compiled = await build({
  entryPoints: ["src/account-login.jsx"],
  bundle: true,
  write: false,
  format: "esm",
  minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [
    {
      name: "fixture",
      setup(b) {
        b.onResolve({ filter: /^@privy-io\/react-auth$/ }, () => ({
          path: "privy",
          namespace: "fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: mock,
          loader: "jsx",
          resolveDir: process.cwd(),
        }));
      },
    },
  ],
});
const browser = await chromium.launch({ headless: true });
const libraries = {
  A: {
    revision: 1,
    playlists: [
      { id: "cloud", name: "Cloud picks", recordIds: ["record-not4me"] },
    ],
  },
  B: { revision: 0, playlists: [] },
};
const report = {
  checkedAt: new Date().toISOString(),
  scope:
    "Real account/profile/playlist components with fixture Privy identity and optimistic-revision HTTP service. No real login, account or production data writes.",
  checks: [],
  errors: [],
  status: "running",
};
let injectConflict = false,
  firstPage;
async function open(initial = null) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.addInitScript((initial) => {
    if (initial && !localStorage.getItem("qa-user"))
      localStorage.setItem(
        "qa-user",
        JSON.stringify({ id: initial, linkedAccounts: [] }),
      );
    Object.defineProperty(navigator, "onLine", {
      get: () => localStorage.getItem("qa-offline") !== "true",
    });
  }, initial);
  await context.route("**/account/account-login.js", (r) =>
    r.fulfill({
      contentType: "application/javascript",
      body: compiled.outputFiles[0].text,
    }),
  );
  await context.route("**/api/auth/config", (r) =>
    r.fulfill({
      json: {
        enabled: true,
        appId: "fixture",
        clientId: "fixture",
        playlistStorage: "private-blob",
      },
    }),
  );
  await context.route("**/api/account", (r) => {
    const id = r.request().headers().authorization?.split("fixture-")[1];
    return r.fulfill({ json: { id, name: "Fixture listener " + id } });
  });
  await context.route("**/api/account/playlists", async (r) => {
    const page = r.request().frame().page();
    if (await page.evaluate(() => !navigator.onLine)) {
      return r.abort("internetdisconnected");
    }
    const id = r.request().headers().authorization?.split("fixture-")[1];
    let library = libraries[id];
    assert.ok(library);
    if (r.request().method() === "PUT") {
      const input = r.request().postDataJSON();
      if (injectConflict && page === firstPage) {
        injectConflict = false;
        library.playlists = library.playlists.map((p) =>
          p.id === "cloud" ? { ...p, name: "Other device edit" } : p,
        );
        library.revision++;
      }
      if (input.revision !== library.revision)
        return r.fulfill({ status: 409, json: { conflict: true } });
      library.revision++;
      library.playlists = input.playlists;
    }
    return r.fulfill({ json: library });
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push(e.message));
  await page.goto(base + "/#playlists", { waitUntil: "domcontentloaded" });
  await page.locator("[data-new-playlist]").waitFor();
  return { page, context };
}
async function create(page, name) {
  await page.locator("[data-new-playlist]").click();
  await page.locator("#playlist-editor input[name=name]").fill(name);
  await page.locator("#playlist-editor button[type=submit]").click();
  await page.getByRole("heading", { name, exact: true }).waitFor();
  return new URL(page.url()).hash.split("/")[1];
}
async function rename(page, name) {
  await page.locator("[data-rename-playlist]").click();
  await page.locator("#playlist-editor input[name=name]").fill(name);
  await page.locator("#playlist-editor button[type=submit]").click();
  await page.getByRole("heading", { name, exact: true }).waitFor();
}
async function until(fn) {
  for (let i = 0; i < 100; i++) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error("Fixture state did not settle");
}
try {
  const { page } = await open();
  firstPage = page;
  const guestId = await create(page, "Guest selection");
  await page.goto(base + "/#me");
  await page
    .locator(".profile-account-card")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await page
    .locator("[data-account-playlist-status]")
    .filter({ hasText: "Saved to your Music Nerd account." })
    .waitFor();
  assert.equal(libraries.A.playlists.length, 2);
  assert.equal(
    await page
      .getByRole("button", {
        name: /Save playlists to account|Load account playlists/,
      })
      .count(),
    0,
  );
  await page.goto(base + "/#playlists");
  const created = await create(page, "Automatic playlist");
  await until(() => libraries.A.playlists.some((p) => p.id === created));
  report.checks.push(
    "Initial guest/cloud merge and automatic create saved without manual controls",
  );
  await page.evaluate(() => localStorage.setItem("qa-offline", "true"));
  await rename(page, "Offline edit");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page
    .getByRole("heading", { name: "Offline edit", exact: true })
    .waitFor();
  assert.ok(!libraries.A.playlists.some((p) => p.name === "Offline edit"));
  await page.evaluate(() => {
    localStorage.removeItem("qa-offline");
    dispatchEvent(new Event("online"));
  });
  await until(() =>
    libraries.A.playlists.some((p) => p.name === "Offline edit"),
  );
  report.checks.push(
    "Offline edit survives reload and saves after online event",
  );
  await page.goto(base + "/#playlist/cloud");
  await page
    .getByRole("heading", { name: "Cloud picks", exact: true })
    .waitFor();
  injectConflict = true;
  await rename(page, "This device edit");
  await until(() =>
    libraries.A.playlists.some(
      (p) => p.name === "This device edit (recovered edit)",
    ),
  );
  assert.ok(libraries.A.playlists.some((p) => p.name === "Other device edit"));
  report.checks.push("409 concurrent edit keeps both named versions");
  const second = await open("A");
  await second.page.getByText("Other device edit", { exact: true }).waitFor();
  await second.page.goto(base + "/#playlist/" + created);
  await second.page.locator("[data-delete-playlist]").click();
  await second.page.locator("#confirm-delete").click();
  await until(() => !libraries.A.playlists.some((p) => p.id === created));
  await page.goto(base + "/#playlists");
  await page.evaluate(() => dispatchEvent(new Event("focus")));
  await page.waitForFunction(
    (id) => !document.querySelector(`a[href="#playlist/${id}"]`),
    created,
  );
  report.checks.push("Second-device deletion refreshes without resurrection");
  await page.goto(base + "/#playlist/cloud");
  await page.locator("[data-rename-playlist]").click();
  await page
    .locator("#playlist-editor input[name=name]")
    .fill("Must not enter B");
  await page.evaluate(() => window.__setUser({ id: "B", linkedAccounts: [] }));
  await page.waitForFunction(
    () => !document.querySelector("#playlist-editor").open,
  );
  await until(() => libraries.B.playlists.some((p) => p.id === guestId));
  assert.ok(
    !libraries.B.playlists.some(
      (p) => p.id === "cloud" || p.name === "Must not enter B",
    ),
  );
  report.checks.push(
    "Account switch closes old draft and imports only original guest selection",
  );
  await page.goto(base + "/#me?tab=playlists");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page
    .locator(".profile-account-card")
    .getByRole("button", { name: "Sign in", exact: true })
    .waitFor();
  await page.getByText("Guest selection", { exact: true }).waitFor();
  assert.equal(
    await page.getByText("Other device edit", { exact: true }).count(),
    0,
  );
  report.checks.push("Logout restores device-only guest library");
  await page
    .locator(".profile-account-card")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await page
    .locator("[data-account-playlist-status]")
    .filter({ hasText: "Saved" })
    .waitFor();
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(
        (t) => (document.documentElement.dataset.theme = t),
        theme,
      );
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      assert.equal(overflow, false);
      await page.screenshot({
        path: `captures/playlist-sync-${width}-${theme}.png`,
        fullPage: true,
      });
    }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
  console.log(JSON.stringify(report));
} catch (e) {
  report.status = "failed";
  report.error = e.message;
  console.log(JSON.stringify(report));
  process.exitCode = 1;
} finally {
  await browser.close();
  writeFileSync(
    "data/playlist-sync-ui-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
}
