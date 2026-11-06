import { build } from "esbuild";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.ARCHIVE_QA_URL || "http://127.0.0.1:4191";
const a = "0x" + "1".repeat(40),
  b = "0x" + "2".repeat(40),
  publicWallet = "0x" + "3".repeat(40);
const user = {
  id: "did:privy:wallet-fixture",
  linkedAccounts: [
    { type: "wallet", chainType: "solana", address: "SolanaFixture" },
    { type: "wallet", chainType: "ethereum", address: a },
    { type: "wallet", chainType: "ethereum", address: b },
  ],
};
const mock = `import React,{createContext,useContext,useState,useEffect}from'react';const C=createContext(null);export function PrivyProvider({children}){const[user,setUser]=useState(window.__initialUser||null);useEffect(()=>{window.__setPrivyUser=setUser},[]);return <C.Provider value={{user,setUser}}>{children}</C.Provider>}export function usePrivy(){const{user,setUser}=useContext(C);return{ready:true,authenticated:!!user,user,logout:()=>setUser(null),getAccessToken:async()=>user?'fixture-token':null}}export function useLogin(){return{login:()=>{}}}export function useWallets(){return{wallets:[]}}export function useLinkAccount(){return{linkWallet:()=>{}}}export function useConnectWallet(){return{connectWallet:()=>{}}}`;
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
const browser = await chromium.launch(),
  report = {
    checkedAt: new Date().toISOString(),
    base,
    scope:
      "Mocked Privy account and indexed-wallet responses exercise UI/isolation; not live account ownership verification.",
    cases: [],
  };
const miami = "record-69c77ef0",
  video = "spinamp-073e25367a01a4e53532",
  cat = "catalog-1-0bc2a24ce568dad89691116d5b34deb6c203f342-52",
  publicSong = "record-not4me";
try {
  for (const width of [1440, 390]) {
    const p = await browser.newPage({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        hasTouch: width === 390,
        isMobile: width === 390,
      }),
      c = { width, calls: [], errors: [] };
    p.on("pageerror", (e) => c.errors.push(e.message));
    try {
      await p.addInitScript((u) => (window.__initialUser = u), user);
      await p.route("**/account/account-login.js", (r) =>
        r.fulfill({
          contentType: "application/javascript",
          body: compiled.outputFiles[0].text,
        }),
      );
      await p.route("**/api/auth/config", (r) =>
        r.fulfill({
          json: { enabled: true, appId: "fixture", clientId: "fixture" },
        }),
      );
      await p.route("**/api/account", (r) =>
        r.fulfill({ json: { id: "fixture", name: "Fixture listener" } }),
      );
      await p.route("**/api/account/playlists", (r) =>
        r.fulfill({ json: { revision: 0, playlists: [] } }),
      );
      let active = 0,
        max = 0;
      await p.route("**/api/wallet/**", async (route) => {
        const u = new URL(route.request().url()),
          address = u.pathname.split("/").pop(),
          chain = u.searchParams.get("chainId");
        c.calls.push({ address, chain });
        active++;
        max = Math.max(max, active);
        await new Promise((resolve) => setTimeout(resolve, 35));
        const id =
          address === publicWallet
            ? publicSong
            : address === b
              ? chain === "1"
                ? cat
                : null
              : chain === "1"
                ? miami
                : chain === "8453"
                  ? video
                  : null;
        active--;
        await route.fulfill({
          json:
            chain === "137"
              ? {
                  status: "unavailable",
                  message: "Fixture provider unavailable",
                }
              : {
                  status: "indexed",
                  items: id
                    ? [{ contract: a, tokenId: "1", recordId: id }]
                    : [],
                  nextCursor: null,
                  checkedAt: "2026-11-06T00:00:00Z",
                },
        });
      });
      await p.goto(base + "/#me");
      await p.waitForFunction(
        () =>
          document.querySelectorAll("[data-wallet-matches] .record-card")
            .length === 2,
        null,
        { timeout: 20000 },
      );
      const matched = () =>
        p
          .locator("[data-wallet-matches] [data-play]")
          .evaluateAll((ns) => ns.map((n) => n.dataset.play));
      assert.deepEqual((await matched()).sort(), [miami, video].sort());
      await p.locator('[data-wallet-filter="media"]').selectOption("video");
      assert.deepEqual(await matched(), [video]);
      await p.locator("[data-wallet-reset-filters]").click();
      await p.locator('[data-wallet-filter="network"]').selectOption("1");
      assert.deepEqual(await matched(), [miami]);
      await p.locator("[data-wallet-reset-filters]").click();
      await p.locator('[data-wallet-filter="platform"]').selectOption("Sound");
      assert.deepEqual(await matched(), [miami]);
      await p.locator("[data-wallet-reset-filters]").click();
      await p.locator('[data-wallet-filter="query"]').fill("MIAMI");
      assert.deepEqual(await matched(), [miami]);
      assert.equal(
        await p.evaluate(() => document.activeElement.dataset.walletFilter),
        "query",
      );
      await p.locator("[data-wallet-reset-filters]").click();
      await p.locator('[data-wallet-filter="sort"]').selectOption("title");
      for (const theme of ["light", "dark"]) {
        await p.evaluate(
          (t) => (document.documentElement.dataset.theme = t),
          theme,
        );
        await p
          .locator('[data-wallet-filter="query"]')
          .scrollIntoViewIfNeeded();
        await p.waitForTimeout(250);
        assert.equal(
          await p.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        await p.screenshot({
          path: `captures/collection-filters-${width}-${theme}.png`,
        });
      }
      await p.evaluate(() => (location.hash = "#explore"));
      await p.locator("[data-owned-filter]").click();
      await p.waitForFunction(
        () => document.querySelectorAll("main .record-card").length === 3,
        null,
        { timeout: 20000 },
      );
      const exploreIds = () =>
        p
          .locator("main .record-card [data-play]")
          .evaluateAll((ns) => ns.map((n) => n.dataset.play));
      assert.deepEqual((await exploreIds()).sort(), [miami, video, cat].sort());
      await p.waitForFunction(() =>
        document
          .querySelector("[data-owned-coverage]")
          ?.textContent.includes("could not complete"),
      );
      for (const theme of ["light", "dark"]) {
        await p.evaluate(
          (t) => (document.documentElement.dataset.theme = t),
          theme,
        );
        await p.waitForTimeout(250);
        await p.screenshot({
          path: `captures/explore-owned-${width}-${theme}.png`,
        });
        assert.equal(
          await p.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
      }
      assert.ok(max <= 2);
      assert.equal(c.calls.length, 10);
      await p.evaluate((w) => (location.hash = "#wallet/" + w), publicWallet);
      await p.waitForFunction(
        (id) =>
          document.querySelector(`[data-wallet-matches] [data-play="${id}"]`),
        publicSong,
      );
      await p.evaluate(() => (location.hash = "#explore"));
      await p.locator('[data-owned-filter][aria-pressed="true"]').waitFor();
      assert.deepEqual((await exploreIds()).sort(), [miami, video, cat].sort());
      await p.evaluate(() => window.__setPrivyUser(null));
      await p.waitForFunction(
        () => document.querySelectorAll("main .record-card").length === 0,
      );
      assert.match(
        await p.locator("main").innerText(),
        /Sign in and link a wallet/,
      );
      c.maxConcurrent = max;
      assert.deepEqual(c.errors, []);
      c.passed = true;
    } catch (e) {
      c.passed = false;
      c.error = e.stack;
    } finally {
      report.cases.push(c);
      await p.close();
    }
  }
  report.passed = report.cases.every((c) => c.passed);
} finally {
  writeFileSync(
    "data/collection-filter-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
assert.equal(report.passed, true);
