import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
const base = process.env.VERIFY_BASE_URL || "http://127.0.0.1:4191";
const label = (process.env.VERIFY_LABEL || "baseline").replace(
  /[^a-z0-9-]/gi,
  "-",
);
const receipt = {
  checkedAt: new Date().toISOString(),
  base,
  label,
  scope:
    "Fresh Chromium contexts on the same host; desktop/mobile viewports only, no device CPU or network emulation. Instrumented index response.text + JSON.parse measures body decoding and parsing separately. One sample per viewport is a diagnostic snapshot, not a benchmark or field INP.",
  cases: [],
};
for (const mobile of [false, true]) {
  const browser = await chromium.launch({
    headless: true,
    args: ["--enable-precise-memory-info"],
  });
  const page = await browser.newPage({
    viewport: { width: mobile ? 390 : 1440, height: mobile ? 844 : 1000 },
    isMobile: mobile,
    hasTouch: mobile,
  });
  const entry = { viewport: mobile ? "390x844" : "1440x1000", errors: [] };
  page.on("pageerror", (error) => entry.errors.push(error.message));
  try {
    await page.addInitScript(() => {
      window.catalogProbe = { longTasks: [], index: null };
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          window.catalogProbe.longTasks.push({
            start: e.startTime,
            duration: e.duration,
          });
      }).observe({ type: "longtask", buffered: true });
      const json = Response.prototype.json;
      Response.prototype.json = async function () {
        if (!this.url.includes("/api/catalog?view=index"))
          return json.call(this);
        const start = performance.now();
        const text = await this.text();
        const decoded = performance.now();
        const result = JSON.parse(text);
        const parsed = performance.now();
        window.catalogProbe.index = {
          url: this.url,
          records: result.records?.length,
          people: result.people?.length,
          characters: text.length,
          bodyReadAndDecodeMs: decoded - start,
          parseMs: parsed - decoded,
          resolvedAtMs: parsed,
        };
        return result;
      };
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Performance.enable");
    await page.goto(base + "/#explore", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () =>
        document.querySelector("#search") &&
        document.querySelector(".record-card") &&
        window.catalogProbe.index,
      null,
      { timeout: 45000 },
    );
    entry.ready = await page.evaluate(() => {
      const resource = performance
        .getEntriesByType("resource")
        .find((e) => e.name.includes("/api/catalog?view=index"));
      return {
        observedReadyAtMs: performance.now(),
        cards: document.querySelectorAll(".record-card").length,
        liveElements: document.querySelectorAll("*").length,
        collectionOptions: document.querySelectorAll(
          '[data-facet="collection"] option',
        ).length,
        index: window.catalogProbe.index,
        resource: resource && {
          startTime: resource.startTime,
          responseStart: resource.responseStart,
          responseEnd: resource.responseEnd,
          transferSize: resource.transferSize,
          encodedBodySize: resource.encodedBodySize,
          decodedBodySize: resource.decodedBodySize,
        },
        navigation: performance.getEntriesByType("navigation").map((n) => ({
          domContentLoadedMs: n.domContentLoadedEventEnd,
          responseEndMs: n.responseEnd,
        })),
      };
    });
    entry.search = await page.evaluate(async () => {
      const input = document.querySelector("#search"),
        start = performance.now();
      input.value = "pete rango";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      return {
        query: input.value,
        dispatchToTwoFramesMs: performance.now() - start,
        cards: document.querySelectorAll(".record-card").length,
        liveElements: document.querySelectorAll("*").length,
        collectionOptions: document.querySelectorAll(
          '[data-facet="collection"] option',
        ).length,
        matchingText: document
          .querySelector("main")
          ?.textContent.includes("Pete Rango"),
      };
    });
    await page.waitForTimeout(200);
    entry.longTasks = await page.evaluate(() => window.catalogProbe.longTasks);
    const metrics = Object.fromEntries(
      (await cdp.send("Performance.getMetrics")).metrics.map((m) => [
        m.name,
        m.value,
      ]),
    );
    entry.cpuAndHeap = Object.fromEntries(
      [
        "JSHeapUsedSize",
        "JSHeapTotalSize",
        "ScriptDuration",
        "TaskDuration",
        "LayoutDuration",
        "RecalcStyleDuration",
        "Nodes",
      ].map((k) => [k, metrics[k]]),
    );
    entry.passed = entry.search.matchingText && entry.errors.length === 0;
  } catch (error) {
    entry.passed = false;
    entry.error = error.message;
  } finally {
    receipt.cases.push(entry);
    await browser.close();
  }
}
receipt.passed = receipt.cases.every((c) => c.passed);
writeFileSync(
  `data/catalog-performance-${label}.json`,
  JSON.stringify(receipt, null, 2) + "\n",
);
console.log(JSON.stringify(receipt, null, 2));
if (!receipt.passed) process.exitCode = 1;
