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
const browser = await chromium.launch({ headless: true }),
  checks = [],
  errors = [];
async function open(width, theme, initial = user, path = "#me") {
  const page = await browser.newPage({ viewport: { width, height: 1100 } }),
    calls = [];
  let active = 0,
    max = 0;
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(
    ({ initial, theme }) => {
      window.__initialUser = initial;
      localStorage.setItem("mn-archive-theme", theme);
    },
    { initial, theme },
  );
  await page.route("**/account/account-login.js", (r) =>
    r.fulfill({
      contentType: "application/javascript",
      body: compiled.outputFiles[0].text,
    }),
  );
  await page.route("**/api/auth/config", (r) =>
    r.fulfill({
      json: { enabled: true, appId: "fixture", clientId: "fixture" },
    }),
  );
  await page.route("**/api/account", (r) =>
    r.fulfill({ json: { id: "fixture", name: "Fixture listener" } }),
  );
  await page.route("**/api/account/playlists", (r) =>
    r.fulfill({ json: { revision: 0, playlists: [] } }),
  );
  await page.route("**/api/wallet/**", async (route) => {
    const url = new URL(route.request().url()),
      chain = url.searchParams.get("chainId"),
      cursor = url.searchParams.get("cursor");
    calls.push({ address: url.pathname.split("/").pop(), chain, cursor });
    active++;
    max = Math.max(max, active);
    await new Promise((resolve) =>
      setTimeout(resolve, chain === "1" ? 900 : 250),
    );
    const items =
      chain === "1"
        ? [
            {
              contract: a,
              tokenId: cursor ? "2" : "1",
              recordId: cursor
                ? "record-not4me"
                : url.pathname.endsWith(b)
                  ? "recovered-sound-1-b2cb781aa0b35aec7acef3f9751b61505fd5715a"
                  : "record-69c77ef0",
            },
          ]
        : chain === "137"
          ? [{ contract: b, tokenId: "3", recordId: null }]
          : [];
    active--;
    try {
      await route.fulfill({
        status: chain === "8453" ? 503 : 200,
        json:
          chain === "8453"
            ? {
                status: "unavailable",
                message: "Base provider temporarily unavailable",
              }
            : {
                status: "indexed",
                items,
                nextCursor: chain === "1" && !cursor ? "second-page" : null,
                checkedAt: "2026-11-06T00:00:00Z",
              },
      });
    } catch {}
  });
  await page.goto(base + "/" + path);
  return { page, calls, max: () => max };
}
try {
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      const { page, calls, max } = await open(width, theme);
      await page.waitForFunction(
        (address) =>
          document.querySelector("#wallet-lookup input")?.value === address,
        a,
      );
      await page.locator(".profile-account-card").waitFor();
      await page.locator("#wallet-lookup input").focus();
      await page.evaluate(() => {
        window.__accountNode = document.querySelector(".profile-account-card");
        window.__audioNode = document.querySelector("#audio");
        window.scrollTo(0, 200);
        window.__startY = scrollY;
      });
      await page.locator('[data-wallet-network="1"] .record-card').waitFor();
      await page
        .locator('[data-wallet-network="8453"] [role="alert"]')
        .waitFor();
      await page.waitForFunction(
        () => !document.querySelector("[data-wallet-chain][disabled]"),
      );
      assert.equal(calls.length, 5);
      assert.ok(max() <= 2);
      assert.equal(
        await page.evaluate(
          () =>
            window.__accountNode ===
            document.querySelector(".profile-account-card"),
        ),
        true,
      );
      assert.equal(
        await page.evaluate(
          () => window.__audioNode === document.querySelector("#audio"),
        ),
        true,
      );
      assert.equal(
        await page.evaluate(
          () =>
            document.activeElement ===
            document.querySelector("#wallet-lookup input"),
        ),
        true,
      );
      assert.equal(
        await page.evaluate(() => scrollY === window.__startY),
        true,
      );
      assert.match(
        await page.locator('[data-wallet-network="10"]').innerText(),
        /No token entries were returned/,
      );
      assert.match(
        await page.locator('[data-wallet-network="137"]').innerText(),
        /No recovered recordings matched/,
      );
      assert.match(
        await page.locator('[data-wallet-network="8453"]').innerText(),
        /Base provider temporarily unavailable/,
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.locator("[data-wallet-library]").evaluate((node) => {
        node.scrollIntoView({ block: "start" });
        window.scrollBy(0, -105);
      });
      await page.screenshot({
        path: `captures/wallet-autoload-${width}-${theme}.png`,
      });
      await page.locator('[data-profile-tab="playlists"]').click();
      await page.locator('[data-profile-tab="collection"]').click();
      await page.waitForTimeout(100);
      assert.equal(calls.length, 5);
      await page.locator('[data-wallet-chain="1"]').click();
      await page.waitForFunction(
        () =>
          document.querySelectorAll('[data-wallet-network="1"] .record-card')
            .length === 2,
      );
      assert.equal(calls.length, 6);
      assert.equal(calls[5].cursor, "second-page");
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      assert.equal(await page.locator("#wallet-lookup input").inputValue(), "");
      assert.equal(await page.locator("[data-wallet-network]").count(), 0);
      checks.push({
        width,
        theme,
        automaticLinkedEVM: true,
        firstPages: 5,
        maxConcurrent: max(),
        explicitPagination: true,
        noRepeatOnTabSwitch: true,
        accountPortalPreserved: true,
        audioNodePreserved: true,
        focusPreserved: true,
        scrollPreserved: true,
        errorAndEmptyDistinct: true,
        clearedOnLogout: true,
        noOverflow: true,
      });
      await page.close();
    }
  const switched = await open(1440, "dark");
  await switched.page.waitForFunction(
    (address) =>
      document.querySelector("#wallet-lookup input")?.value === address,
    a,
  );
  await switched.page.evaluate(
    ({ address }) =>
      window.__setPrivyUser({
        id: "did:privy:second-fixture",
        linkedAccounts: [{ type: "wallet", chainType: "ethereum", address }],
      }),
    { address: b },
  );
  await switched.page.waitForFunction(
    (address) =>
      document.querySelector("#wallet-lookup input")?.value === address,
    b,
  );
  await switched.page
    .locator(
      '[data-wallet-network="1"] [data-play="recovered-sound-1-b2cb781aa0b35aec7acef3f9751b61505fd5715a"]',
    )
    .waitFor();
  await switched.page.waitForTimeout(1100);
  assert.equal(
    await switched.page
      .locator('[data-wallet-library] [data-play="record-69c77ef0"]')
      .count(),
    0,
  );
  await switched.page.close();
  const ens = await open(1440, "light", user, "#me?tab=collection&wallet=" + a);
  await ens.page.locator('[data-wallet-network="1"] .record-card').waitFor();
  const ensCalls = [];
  await ens.page.route("**/api/wallet/resolve?*", async (route) => {
    const name = new URL(route.request().url()).searchParams.get("name");
    ensCalls.push(name);
    await new Promise((resolve) =>
      setTimeout(resolve, name === "slow.eth" ? 800 : 200),
    );
    try {
      await route.fulfill({
        status: name === "missing.eth" ? 404 : 200,
        json:
          name === "missing.eth"
            ? {
                status: "not-found",
                message: "This ENS name has no Ethereum address.",
              }
            : {
                status: "resolved",
                name,
                address: b,
                source: "https://app.ens.domains/" + name,
                checkedAt: new Date().toISOString(),
              },
      });
    } catch {}
  });
  const ensInput = ens.page.locator("#wallet-lookup input"),
    ensButton = ens.page.locator("#wallet-lookup button");
  await ensInput.fill("https://example.com");
  await ensButton.click();
  assert.equal(ensCalls.length, 0);
  assert.match(
    await ens.page.locator("[data-wallet-lookup-status]").innerText(),
    /Enter an Ethereum address/,
  );
  await ensInput.fill("missing.eth");
  await ensButton.click();
  await ens.page.getByText("This ENS name has no Ethereum address.").waitFor();
  assert.ok(
    await ens.page.locator('[data-wallet-network="1"] .record-card').count(),
  );
  await ensInput.fill("slow.eth");
  await ensButton.click();
  await ensInput.focus();
  assert.ok(
    await ens.page.locator('[data-wallet-network="1"] .record-card').count(),
  );
  assert.equal(await ensInput.inputValue(), "slow.eth");
  await ensInput.fill("new.eth");
  await ens.page.waitForTimeout(900);
  assert.ok(ens.page.url().endsWith(a));
  assert.equal(await ensInput.inputValue(), "new.eth");
  await ensInput.fill("slow.eth");
  await ensButton.click();
  await ens.page.evaluate(
    (address) =>
      window.__setPrivyUser({
        id: "did:privy:ens-switch",
        linkedAccounts: [{ type: "wallet", chainType: "ethereum", address }],
      }),
    b,
  );
  await ens.page.waitForTimeout(900);
  assert.ok(ens.page.url().endsWith(a));
  await ensInput.fill("slow.eth");
  await ensButton.click();
  await ens.page.evaluate(() => (location.hash = "explore"));
  await ens.page.waitForTimeout(900);
  assert.ok(ens.page.url().endsWith("#explore"));
  await ens.page.goto(base + "/#me?tab=collection&wallet=" + a);
  await ensInput.fill("listener.eth");
  await ensButton.click();
  await ens.page.waitForFunction(
    (address) =>
      document.querySelector("#wallet-lookup input")?.value === address,
    b,
  );
  assert.match(
    await ens.page.locator("[data-wallet-resolution]").innerText(),
    /listener.eth/,
  );
  assert.equal(
    await ens.page
      .getByRole("link", { name: "ENS source" })
      .getAttribute("href"),
    "https://app.ens.domains/listener.eth",
  );
  await ens.page.close();
  const explicit = await open(
    1440,
    "light",
    null,
    "#me?tab=collection&wallet=" + publicWallet,
  );
  await explicit.page.waitForFunction(() => !!window.__setPrivyUser);
  await explicit.page.evaluate((user) => window.__setPrivyUser(user), user);
  await explicit.page.waitForTimeout(100);
  assert.equal(
    await explicit.page.locator("#wallet-lookup input").inputValue(),
    publicWallet,
  );
  assert.ok(explicit.calls.every((call) => call.address === publicWallet));
  await explicit.page
    .getByRole("link", { name: "Listen to this wallet" })
    .nth(1)
    .click();
  await explicit.page.waitForFunction(
    (address) =>
      document.querySelector("#wallet-lookup input")?.value === address,
    b,
  );
  await explicit.page.close();
  assert.deepEqual(errors, []);
  const result = {
    checkedAt: new Date().toISOString(),
    base,
    scope:
      "Actual rendered application using explicitly mocked Privy/account/wallet HTTP responses; not a real personal login or chain audit.",
    checks,
    explicitPublicWalletSurvivesLateAuth: true,
    linkedWalletListenSelection: true,
    accountSwitchDiscardsOldResults: true,
    ens: {
      submitOnly: true,
      rejectsURLs: true,
      notFoundRetainsResults: true,
      latestTypedInputWins: true,
      accountChangeCancels: true,
      routeChangeCancels: true,
      normalizedAddressRoute: true,
      sourceLabel: true,
    },
    errors,
  };
  writeFileSync(
    "data/wallet-autoload-ui-verification.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
