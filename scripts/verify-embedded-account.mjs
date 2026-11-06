import { chromium, webkit } from "playwright";
import { createServer } from "node:http";
import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const base = process.env.BASE_URL || "http://127.0.0.1:4191";
const parent = createServer((req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.end(
    `<html><style>body{margin:0}iframe{border:0;width:100vw;height:100vh}</style><iframe src="${base}/#me" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads" allow="fullscreen"></iframe></html>`,
  );
});
await new Promise((resolve) => parent.listen(0, "127.0.0.1", resolve));
const parentURL = "http://127.0.0.1:" + parent.address().port;
const report = {
  checkedAt: new Date().toISOString(),
  base,
  scope:
    "Cross-origin sandbox matching Lab. No OTP, wallet signature or account mutation. Local top-level SDK initialization only; real login requires an approved origin.",
  views: [],
};
try {
  for (const engine of ["chromium", "webkit"]) {
    const browser = await { chromium, webkit }[engine].launch({
      headless: true,
    });
    try {
      const variants =
        engine === "chromium"
          ? [
              [1440, "light"],
              [1440, "dark"],
              [390, "light"],
              [390, "dark"],
            ]
          : [[390, "dark"]];
      for (const [width, theme] of variants) {
        const context = await browser.newContext({
          viewport: { width, height: 1000 },
        });
        await context.addInitScript(
          (theme) => localStorage.setItem("mn-archive-theme", theme),
          theme,
        );
        const page = await context.newPage();
        const requests = [],
          errors = [];
        page.on("request", (r) => requests.push(r.url()));
        page.on("pageerror", (e) => errors.push(e.message));
        await page.goto(parentURL, { waitUntil: "domcontentloaded" });
        const frame = page.frameLocator("iframe");
        const link = frame.locator("#profile-account a.primary");
        await link.waitFor({ timeout: 30000 });
        await frame
          .locator("html")
          .evaluate((html, theme) => (html.dataset.theme = theme), theme);
        await page.waitForTimeout(1000);
        assert.equal(await link.getAttribute("href"), base + "/#me");
        assert.equal(await link.getAttribute("target"), "_blank");
        assert.equal(await link.getAttribute("rel"), "noopener noreferrer");
        assert.equal(
          requests.filter((u) =>
            /auth\.privy\.io|privy\.musicnerd\.net|\/api\/auth\/config/.test(u),
          ).length,
          0,
          "Embedded account must not initialize auth",
        );
        assert.equal(
          await frame.locator("iframe").count(),
          0,
          "No nested auth frames",
        );
        const accountState = await frame.locator("html").evaluate(() => {
          let value;
          document.addEventListener(
            "mn:account-wallets",
            (e) => {
              value = e.detail;
            },
            { once: true },
          );
          document.dispatchEvent(new Event("mn:request-account-wallets"));
          return value;
        });
        assert.deepEqual(accountState, {
          ready: true,
          authenticated: false,
          accountId: null,
          addresses: [],
        });
        assert.deepEqual(errors, []);
        const overflow = await frame
          .locator("html")
          .evaluate((e) => e.scrollWidth > innerWidth);
        assert.equal(overflow, false);
        const capture = `captures/embedded-account-${engine}-${width}-${theme}.png`;
        await page.screenshot({ path: capture, fullPage: true });
        const entry = {
          engine,
          width,
          theme,
          authRequests: 0,
          nestedFrames: 0,
          overflow,
          capture,
          errors,
        };
        if (width === 390) {
          const newPage = context.waitForEvent("page");
          await link.click();
          const standalone = await newPage;
          await standalone.waitForURL(base + "/#me");
          await standalone
            .locator("#account-root .outline-button")
            .waitFor({ timeout: 20000 });
          entry.escape = await standalone.evaluate(() => ({
            topLevel: self === top,
            openerNull: opener === null,
            hash: location.hash,
          }));
          assert.deepEqual(entry.escape, {
            topLevel: true,
            openerNull: true,
            hash: "#me",
          });
          entry.directAccountModuleLoaded = await standalone.evaluate(() =>
            performance
              .getEntriesByType("resource")
              .some((r) => /\/account\/account-login-[^/]+\.js/.test(r.name)),
          );
          assert.equal(entry.directAccountModuleLoaded, true);
          entry.directAccountControl = await standalone
            .locator("#account-root")
            .innerText();
          await standalone.close();
        }
        report.views.push(entry);
        await context.close();
      }
    } finally {
      await browser.close();
    }
  }
  report.status = "passed";
} finally {
  parent.closeAllConnections();
  await new Promise((resolve) => parent.close(resolve));
  writeFileSync(
    "data/embedded-account-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
}
console.log(
  JSON.stringify({ status: report.status, views: report.views.length }),
);
