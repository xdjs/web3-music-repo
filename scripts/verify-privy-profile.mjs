import { build } from "esbuild";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const mock = `import React,{createContext,useContext,useState} from 'react';
const C=createContext(null);
export function PrivyProvider({children}) { const [user,setUser]=useState(null); return <C.Provider value={{user,setUser}}>{children}</C.Provider>; }
export function usePrivy(){const {user,setUser}=useContext(C);return {ready:true,authenticated:!!user,user,logout:()=>setUser(null),getAccessToken:async()=>user?'fixture-token':null};}
export function useLogin(callbacks){ const {setUser}=useContext(C); return {login:()=>{setUser({id:'did:privy:fixture',linkedAccounts:[{type:'wallet',chainType:'ethereum',address:'0x1111111111111111111111111111111111111111'}]});callbacks.onComplete?.();}};}
export function useWallets(){return {wallets:[]};}
export function useLinkAccount(callbacks){const {setUser}=useContext(C);return {linkWallet:()=>{setUser((user)=>({...user,linkedAccounts:[...user.linkedAccounts,{type:'wallet',chainType:'ethereum',address:'0x2222222222222222222222222222222222222222'}]}));callbacks.onSuccess?.();}};}
export function useConnectWallet(callbacks){return {connectWallet:()=>callbacks.onSuccess?.()};}`;
const compiled = await build({
  entryPoints: ["src/account-login.jsx"],
  bundle: true,
  write: false,
  format: "esm",
  minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [
    {
      name: "privy-fixture",
      setup(builder) {
        builder.onResolve({ filter: /^@privy-io\/react-auth$/ }, () => ({
          path: "privy",
          namespace: "fixture",
        }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: mock,
          loader: "jsx",
          resolveDir: process.cwd(),
        }));
      },
    },
  ],
});
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
let library = { revision: 0, playlists: [] },
  needsSetup = false;
const errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/account/account-login.js", (route) =>
  route.fulfill({
    contentType: "application/javascript",
    body: compiled.outputFiles[0].text,
  }),
);
await page.route("**/api/auth/config", (route) =>
  route.fulfill({
    json: {
      enabled: true,
      appId: "fixture",
      clientId: "fixture",
      playlistStorage: "private-blob",
    },
  }),
);
await page.route("**/api/account", (route) =>
  route.fulfill({
    status: needsSetup ? 409 : 200,
    json: needsSetup
      ? {
          needsMusicNerdAccount: true,
          error: "Finish Music Nerd account setup",
        }
      : { id: "test-account", name: "Test listener" },
  }),
);
await page.route("**/api/account/playlists", (route) => {
  if (needsSetup)
    return route.fulfill({
      status: 409,
      json: {
        needsMusicNerdAccount: true,
        error: "Finish Music Nerd account setup",
      },
    });
  if (route.request().method() === "PUT") {
    const input = route.request().postDataJSON();
    assert.equal(input.revision, library.revision);
    library = { revision: library.revision + 1, playlists: input.playlists };
  }
  return route.fulfill({ json: library });
});
await page.addInitScript(() => {
  if (!localStorage.getItem("mn-archive-playlists-v1"))
    localStorage.setItem(
      "mn-archive-playlists-v1",
      JSON.stringify([
        {
          id: "fixture-list",
          name: "Test playlist",
          recordIds: ["record-not4me"],
        },
      ]),
    );
});
try {
  await page.goto("http://127.0.0.1:4191/#me");
  await page
    .locator(".profile-account-card")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Test listener", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Add a wallet to my account" })
    .click();
  assert.equal(
    await page.getByRole("link", { name: "Listen to this wallet" }).count(),
    2,
  );
  await page.getByRole("button", { name: "Connect a linked wallet" }).click();
  await page
    .getByText("Wallet connected in this browser.", { exact: false })
    .waitFor();
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      assert.equal(
        await page.evaluate(() => document.body.scrollWidth > innerWidth),
        false,
      );
      await page.screenshot({
        path: `captures/privy-profile-${width}-${theme}.png`,
      });
      checks.push({ width, theme, linkedWallets: 2, overflow: false });
    }
  await page
    .locator("[data-account-playlist-status]")
    .filter({ hasText: "Saved" })
    .waitFor();
  assert.equal(library.playlists[0].name, "Test playlist");
  assert.equal(
    await page
      .getByRole("button", {
        name: /Save playlists to account|Load account playlists/,
      })
      .count(),
    0,
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page
    .locator(".profile-account-card")
    .getByRole("button", { name: "Sign in", exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole("link", { name: "Listen to this wallet" }).count(),
    0,
  );
  needsSetup = true;
  await page
    .locator(".profile-account-card")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Open Music Nerd to finish account setup" })
    .waitFor();
  needsSetup = false;
  await page.getByRole("button", { name: "Retry account connection" }).click();
  await page.getByRole("heading", { name: "Test listener" }).waitFor();
  await page.goto("http://127.0.0.1:4191/#me?tab=playlists");
  await page.getByText("Test playlist", { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  const result = {
    checkedAt: new Date().toISOString(),
    scope:
      "Real app components with mocked Privy SDK and account HTTP responses; verifies UI state and browser playlist flow, not real authentication.",
    checks,
    automaticSync: true,
    linkWallet: true,
    onboardingRetry: true,
    logoutClearsWallets: true,
    errors,
  };
  writeFileSync(
    "data/privy-profile-verification.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
