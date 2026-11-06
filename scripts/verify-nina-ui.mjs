import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.VERIFY_BASE_URL || "http://127.0.0.1:4191",
  id = "spinamp-52652b7e8c0c93fdc260",
  artist = "spinamp-artist-8d6af7aeb9f19ed9d57d",
  mint = "122gW5E6uqWKEsb1KdCjVhWtarbCTdN7hR1bjt9dgdaw";
const r = { checkedAt: new Date().toISOString(), base, cases: [] },
  b = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    const p = await b.newPage({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        hasTouch: width === 390,
        isMobile: width === 390,
      }),
      c = { width, forbiddenRequests: [], errors: [] };
    p.on("request", (q) => {
      if (/\/api\/(collectors|owner|holders)(?:\?|\/|$)/.test(q.url()))
        c.forbiddenRequests.push(q.url());
    });
    p.on("pageerror", (e) => c.errors.push(e.message));
    try {
      await p.goto(base + "/#explore");
      await p.locator('[data-filter="Nina"]').click();
      await p.locator(".record-card").first().waitFor();
      c.ninaCount = await p.locator(".results").innerText();
      assert.ok(Number(c.ninaCount.replace(/\D/g, "")) > 6000);
      assert.ok(
        (await p.locator(".cover-badge").allTextContents()).every(
          (t) => t === "Nina",
        ),
      );
      await p.locator('[data-facet="network"]').selectOption("solana");
      assert.ok((await p.locator(".record-card").count()) > 0);
      await p.locator('[data-filter="Other platforms"]').click();
      assert.equal(await p.locator(".record-card").count(), 0);
      await p.evaluate((id) => (location.hash = "#record/" + id), id);
      await p.locator(".record-head h1").waitFor();
      assert.equal(
        await p.locator(".record-head h1").innerText(),
        "Error Handling",
      );
      assert.match(
        await p.locator(".record-head .eyebrow").innerText(),
        /Nina · Solana/i,
      );
      await p.locator('[data-tab="proof"]').click();
      await p.locator("#verify-status").waitFor();
      const proof = await p.locator('[role="tabpanel"]').innerText();
      assert.match(proof, /not been independently verified/);
      assert.ok(proof.includes(mint));
      assert.equal(
        await p
          .locator(`a[href="https://explorer.solana.com/address/${mint}"]`)
          .count(),
        1,
      );
      assert.ok(
        (await p
          .locator(
            'a[href="https://nina.market/CZ2wpojt6YHhPPaGJNUuyXPAFDwGjEK1tbJHipcMT1Wn"]',
          )
          .count()) > 0,
      );
      assert.equal(
        await p.locator("[data-recover],[data-owner],[data-holders]").count(),
        0,
      );
      try {
        await p.waitForFunction(
          () => {
            const img = document.querySelector(".record-head img");
            return (
              img?.complete &&
              img.naturalWidth > 0 &&
              !img.currentSrc.startsWith("data:")
            );
          },
          null,
          { timeout: 12000 },
        );
      } catch {}
      c.cover = await p.locator(".record-head img").evaluate((img) => ({
        source: img.currentSrc,
        loaded: img.complete && img.naturalWidth > 0,
        width: img.naturalWidth,
        height: img.naturalHeight,
      }));
      for (const theme of ["light", "dark"]) {
        await p.evaluate(
          (t) => (document.documentElement.dataset.theme = t),
          theme,
        );
        await p.waitForTimeout(250);
        await p.screenshot({
          path: `captures/nina-proof-${width}-${theme}.png`,
          fullPage: true,
        });
        assert.equal(
          await p.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
      }
      await p.locator('[data-tab="collectors"]').click();
      await p
        .getByRole("heading", { name: "Solana collectors", exact: true })
        .waitFor();
      assert.match(
        await p.locator('[role="tabpanel"]').innerText(),
        /not implemented yet/,
      );
      assert.equal(await p.locator("[data-owner],[data-holders]").count(), 0);
      await p.locator(`.record-head a[href="#artist/${artist}"]`).click();
      await p.locator(".artist-identity h1").waitFor();
      assert.equal(
        await p.locator(".artist-identity h1").innerText(),
        "Igor Dyachenko",
      );
      assert.ok((await p.locator(".record-card").count()) > 0);
      assert.ok((await p.locator(".record-card").count()) <= 40);
      await p.evaluate(() => (location.hash = "#artists"));
      await p.locator("#artist-search").fill("Igor Dyachenko");
      assert.ok((await p.locator(`a[href="#artist/${artist}"]`).count()) > 0);
      await p.evaluate(
        () =>
          (location.hash = "#record/spinamp-d3f0055720391112ca3e?tab=proof"),
      );
      await p.locator("#verify-status").waitFor();
      const preserved = await p.locator('[role="tabpanel"]').innerText();
      assert.match(
        preserved,
        /original.*(?:did not start|did not complete|timed out|startup)/i,
      );
      assert.match(preserved, /may be transcoded/);
      assert.match(preserved, /original indexed media/i);
      c.preservedAudioDisclosure = true;
      assert.deepEqual(c.forbiddenRequests, []);
      assert.deepEqual(c.errors, []);
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
    "data/nina-ui-verification.json",
    JSON.stringify(r, null, 2) + "\n",
  );
  console.log(JSON.stringify(r, null, 2));
  await b.close();
}
assert.equal(r.passed, true);
