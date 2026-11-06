// Bounded public-holdings pagination. Resume the saved cursor; --refresh starts over.
import { chromium } from "playwright";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const file = "data/pete-recovery/opensea-holdings.json";
const seed = JSON.parse(
  readFileSync("data/pete-recovery/opensea-holdings-query.json"),
);
const refresh = process.argv.includes("--refresh");
const out =
  !refresh && existsSync(file)
    ? JSON.parse(readFileSync(file))
    : {
        checkedAt: new Date().toISOString(),
        source: "https://opensea.io/p3t3rango/holdings/items?view=grid",
        wallet: "0x625307de45bd25ad6bf6cc7391a308fc84067cf7",
        scope:
          "Public visible holdings; discovery only, not creator attribution.",
        pages: [],
        items: [],
        complete: false,
      };
if (out.complete && !refresh) {
  console.log("Saved public pagination already exhausted:", out.items.length);
  process.exit(0);
}
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const seen = new Set(
  out.items.map(
    (x) => `${x.chain.identifier}:${x.contractAddress}:${x.tokenId}`,
  ),
);
let after = out.pages.at(-1)?.nextPageCursor;
try {
  for (let i = 0; i < 12; i++) {
    const url = new URL(seed.url),
      vars = JSON.parse(url.searchParams.get("variables"));
    if (after) vars.after = after;
    url.searchParams.set("variables", JSON.stringify(vars));
    const response = await context.request.get(url.href, { timeout: 15000 });
    if (!response.ok()) throw Error("HTTP " + response.status());
    const body = await response.json();
    if (body.errors) throw Error(JSON.stringify(body.errors).slice(0, 400));
    const data = body.data?.profileItemsV2;
    if (!data || !Array.isArray(data.items))
      throw Error("Missing profileItemsV2");
    let added = 0;
    for (const item of data.items) {
      const key = `${item.chain.identifier}:${item.contractAddress}:${item.tokenId}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.items.push(item);
        added++;
      }
    }
    out.pages.push({
      index: out.pages.length + 1,
      count: data.items.length,
      added,
      nextPageCursor: data.nextPageCursor,
    });
    console.log(
      "page",
      out.pages.length,
      "added",
      added,
      "total",
      out.items.length,
    );
    after = data.nextPageCursor;
    if (!after) {
      out.complete = true;
      break;
    }
    if (!added) throw Error("Repeated page; refusing pagination loop");
    delete out.error;
    writeFileSync(file, JSON.stringify(out, null, 2));
    await new Promise((r) => setTimeout(r, 350));
  }
} catch (e) {
  out.error = e.message;
  console.log(e.message);
  process.exitCode = 1;
} finally {
  out.updatedAt = new Date().toISOString();
  writeFileSync(file, JSON.stringify(out, null, 2));
  await browser.close();
}
