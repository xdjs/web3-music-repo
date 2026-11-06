import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
process.chdir(fileURLToPath(new URL("../", import.meta.url)));
const r = {
    scope:
      "Real browser queue interactions; this check does not require upstream media to finish loading.",
    checkedAt: new Date().toISOString(),
    base: process.env.VERIFY_BASE_URL || "http://127.0.0.1:4191",
    cases: [],
  },
  b = await chromium.launch();
try {
  for (const shuffle of [false, true]) {
    const p = await b.newPage({ viewport: { width: 1440, height: 1000 } }),
      c = { shuffle };
    try {
      await p.addInitScript(
        (on) => localStorage.setItem("mn-archive-shuffle", String(on)),
        shuffle,
      );
      await p.goto(r.base + "/#explore");
      await p.locator("#search").fill("pete rango");
      await p.waitForFunction(
        () => document.querySelectorAll("main [data-play]").length >= 4,
      );
      const ids = await p
        .locator("main [data-play]")
        .evaluateAll((ns) => [...new Set(ns.map((n) => n.dataset.play))]);
      const clicked = ids[3],
        expected = [...ids.slice(3), ...ids.slice(0, 3)];
      c.clicked = clicked;
      c.visible = ids;
      await p.locator(`[data-play="${clicked}"]`).click();
      const read = async () =>
        p
          .locator("#queue-list [data-play-record]")
          .evaluateAll((ns) => ns.map((n) => n.dataset.playRecord));
      const open = async () => {
        await p.locator("#show-queue").click();
        await p.locator("#queue-dialog[open]").waitFor();
      };
      const close = async () => p.locator("#queue-dialog [data-close]").click();
      await open();
      c.initial = await read();
      await p.screenshot({
        path: `captures/contextual-queue-first-${shuffle ? "shuffle" : "ordered"}.png`,
      });
      assert.equal(c.initial[0], clicked);
      assert.deepEqual([...c.initial].sort(), [...expected].sort());
      assert.equal(
        await p
          .locator(".queue-item.current [data-queue-play]")
          .getAttribute("data-queue-play"),
        "0",
      );
      if (!shuffle) assert.deepEqual(c.initial, expected);
      await close();
      await p.locator("#shuffle").click();
      await p.locator("#shuffle").click();
      await open();
      c.afterToggle = await read();
      assert.equal(c.afterToggle[0], clicked);
      if (shuffle) {
        await close();
        await p.locator("#shuffle").click();
        await open();
        assert.deepEqual(await read(), expected);
      } else assert.deepEqual(c.afterToggle, expected);
      await close();
      await p.locator("#next").click();
      await open();
      assert.equal(
        await p
          .locator(".queue-item.current [data-queue-play]")
          .getAttribute("data-queue-play"),
        "1",
      );
      assert.deepEqual(await read(), expected);
      await p.locator("#clear-queue").click();
      await close();
      for (const id of [ids[0], clicked, ids[0]]) {
        await p.evaluate((id) => (location.hash = "#record/" + id), id);
        await p.locator(`[data-queue="${id}"]`).click();
      }
      await p.evaluate(() => (location.hash = "#explore"));
      await p.locator("#search").fill("pete rango");
      await p.locator(`[data-play="${clicked}"]`).click();
      await open();
      c.explicit = await read();
      assert.deepEqual(c.explicit, [ids[0], clicked, ids[0]]);
      assert.equal(
        await p
          .locator(".queue-item.current [data-queue-play]")
          .getAttribute("data-queue-play"),
        "1",
      );
      await p.locator(".queue-drag-handle").nth(1).focus();
      await p.keyboard.press("ArrowDown");
      c.reordered = await read();
      assert.deepEqual(c.reordered, [ids[0], ids[0], clicked]);
      assert.equal(
        await p
          .locator(".queue-item.current [data-queue-play]")
          .getAttribute("data-queue-play"),
        "2",
      );
      await close();
      await p.locator(`[data-play="${ids[0]}"]`).click();
      await open();
      assert.deepEqual(await read(), c.reordered);
      await p.screenshot({
        path: `captures/contextual-queue-${shuffle ? "shuffle" : "ordered"}.png`,
      });
      c.passed = true;
    } catch (e) {
      c.passed = false;
      c.error = e.stack;
    } finally {
      r.cases.push(c);
      await p.close();
    }
  }
  r.passed = r.cases.every((c) => c.passed);
} finally {
  writeFileSync(
    "data/contextual-queue-verification.json",
    JSON.stringify(r, null, 2) + "\n",
  );
  console.log(JSON.stringify(r, null, 2));
  await b.close();
}
assert.equal(r.passed, true);
