import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
const base = process.env.ARCHIVE_QA_URL || "https://web3-music-repo.vercel.app";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const registrations = [],
  warnings = [],
  frames = [];
const safe = (s) =>
  String(s).replace(/(https?:\/\/[^\s?]+)\?[^\s)]*/g, "$1?[redacted-query]");
page.on("console", (m) => {
  const text = m.text();
  if (text.startsWith("__unload_probe__")) {
    try {
      registrations.push(JSON.parse(text.slice(16)));
    } catch {}
  } else if (/unload|permissions policy/i.test(text))
    warnings.push({
      source: "console",
      type: m.type(),
      text: safe(text),
      location: m.location(),
    });
});
page.on("frameattached", () => {});
const cdp = await page.context().newCDPSession(page);
await cdp.send("Log.enable");
cdp.on("Log.entryAdded", ({ entry }) => {
  if (/unload|permissions policy/i.test(entry.text))
    warnings.push({
      source: "ChromeLog",
      text: safe(entry.text),
      url: safe(entry.url || ""),
      stack: entry.stackTrace,
    });
});
await page.addInitScript(() => {
  const add = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, ...args) {
    if (type === "unload" || type === "beforeunload") {
      console.debug(
        "__unload_probe__" +
          JSON.stringify({
            type,
            frame: location.origin + location.pathname,
            stack: new Error().stack?.replace(
              /(https?:\/\/[^\s?]+)\?[^\s)]*/g,
              "$1?[redacted-query]",
            ),
          }),
      );
    }
    return add.call(this, type, ...args);
  };
});
let modalOpened = false,
  error;
try {
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(7000);
  const signIn = page.getByRole("button", { name: /sign in/i }).first();
  if (await signIn.count()) {
    await signIn.click();
    await page.getByPlaceholder(/email/i).waitFor({ timeout: 30000 });
    await page.waitForTimeout(5000);
    modalOpened = await page.getByPlaceholder(/email/i).isVisible();
  }
  for (const f of page.frames()) frames.push(safe(f.url()));
} catch (e) {
  error = e.message;
} finally {
  await browser.close();
}
const report = {
  checkedAt: new Date().toISOString(),
  base,
  scope:
    "Fresh unsigned-in Chromium; initial page and Privy login modal, no email submission, OTP or wallet signature. Hooks unload/beforeunload registrations in all frames without changing policy.",
  modalOpened,
  registrations,
  warnings,
  frames,
  error,
};
writeFileSync(
  "data/unload-policy-verification.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    modalOpened,
    registrations: registrations.length,
    warnings: warnings.length,
    error,
  }),
);
