import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.VERIFY_BASE_URL || "http://127.0.0.1:4191",
  r = { checkedAt: new Date().toISOString(), base, cases: [] },
  b = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    const context = await b.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        hasTouch: width === 390,
        isMobile: width === 390,
        permissions: ["clipboard-read", "clipboard-write"],
      }),
      p = await context.newPage(),
      c = { width, entities: [] };
    try {
      await p.addInitScript(() =>
        Object.defineProperty(navigator, "share", {
          configurable: true,
          value: undefined,
        }),
      );
      for (const [kind, route] of [
        ["record", "#record/record-not4me"],
        ["artist", "#artist/pete-rango"],
        ["playlist", "#historic-playlists"],
      ]) {
        await p.goto(base + "/" + route);
        const button = p.locator(`[data-share-entity="${kind}"]`);
        await button.waitFor();
        assert.equal(await button.count(), 1);
        const id = await button.getAttribute("data-share-id"),
          title = await button.getAttribute("data-share-title"),
          hash = await p.evaluate(() => location.hash);
        await button.click();
        await p.waitForFunction(
          () => document.querySelector("#toast")?.textContent === "Link copied",
        );
        const copied = await p.evaluate(() => navigator.clipboard.readText());
        assert.equal(
          copied,
          base + "/share/" + kind + "/" + encodeURIComponent(id),
        );
        assert.equal(await p.evaluate(() => location.hash), hash);
        assert.equal(await button.isDisabled(), false);
        for (const theme of ["light", "dark"]) {
          await p.evaluate(
            (t) => (document.documentElement.dataset.theme = t),
            theme,
          );
          await button.scrollIntoViewIfNeeded();
          await p.waitForTimeout(250);
          assert.equal(
            await p.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
          );
          await p.screenshot({
            path: `captures/share-${kind}-${width}-${theme}.png`,
          });
        }
        c.entities.push({ kind, id, title, copied });
      }
      // Native share success/cancellation and manual copy use the same visible action.
      await p.goto(base + "/#record/record-not4me");
      const btn = p.locator('[data-share-entity="record"]');
      await btn.waitFor();
      await p.evaluate(() => {
        window.sharedCalls = [];
        Object.defineProperty(navigator, "share", {
          configurable: true,
          value: async (d) => {
            window.sharedCalls.push(d);
          },
        });
      });
      await btn.click();
      assert.equal(await p.evaluate(() => window.sharedCalls.length), 1);
      await p.evaluate(() =>
        Object.defineProperty(navigator, "share", {
          configurable: true,
          value: async () => {
            throw new DOMException("Cancelled", "AbortError");
          },
        }),
      );
      await btn.click();
      assert.equal(
        await p
          .getByRole("dialog", { name: "Share link", exact: true })
          .count(),
        0,
      );
      await p.evaluate(() => {
        Object.defineProperty(navigator, "share", {
          configurable: true,
          value: undefined,
        });
        Object.defineProperty(navigator.clipboard, "writeText", {
          configurable: true,
          value: async () => {
            throw Error("Clipboard unavailable");
          },
        });
      });
      await btn.click();
      const dialog = p.getByRole("dialog", { name: "Share link", exact: true });
      await dialog.waitFor();
      assert.equal(
        await dialog.locator("input").inputValue(),
        base + "/share/record/record-not4me",
      );
      await dialog.getByRole("button", { name: "Done", exact: true }).click();
      assert.equal(await dialog.count(), 0);
      c.manualFallback = true;
      c.nativeShareAndCancel = true;
      c.passed = true;
    } catch (e) {
      c.passed = false;
      c.error = e.stack;
    } finally {
      r.cases.push(c);
      await context.close();
    }
  }
  r.passed = r.cases.every((c) => c.passed);
} finally {
  writeFileSync(
    "data/entity-share-ui-verification.json",
    JSON.stringify(r, null, 2) + "\n",
  );
  console.log(JSON.stringify(r, null, 2));
  await b.close();
}
assert.equal(r.passed, true);
