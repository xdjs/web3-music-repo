import test from "node:test";
import assert from "node:assert/strict";
import {
  collectorQueryKind,
  exactCollectorAddress,
  createCollectorSearch,
  collectorSearchMarkup,
} from "../src/collector-search.mjs";
const a = "0x" + "a".repeat(40),
  b = "0x" + "b".repeat(40);
const esc = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
test("only exact wallets and matching resolved ENS can navigate directly; display names never do", () => {
  assert.equal(exactCollectorAddress(a.toUpperCase().replace("0X", "0x")), a);
  assert.equal(collectorQueryKind("pete.eth"), "ens");
  assert.equal(collectorQueryKind("music.example"), "ens");
  assert.equal(
    exactCollectorAddress("Pete", { items: [{ address: a, name: "Pete" }] }),
    "",
  );
  assert.equal(
    exactCollectorAddress("pete.eth", {
      ens: { status: "resolved", name: "else.eth", address: a },
    }),
    "",
  );
  assert.equal(
    exactCollectorAddress("Pete.eth", {
      ens: { status: "resolved", name: "pete.eth", address: a },
    }),
    a,
  );
  assert.equal(
    exactCollectorAddress("pete.eth", {
      ens: { status: "unavailable", name: "pete.eth", address: a },
    }),
    "",
  );
});
test("older async identity searches cannot replace new matches", async () => {
  const waiting = new Map(),
    signals = [];
  const search = createCollectorSearch({
    fetchResults: (q, signal) => {
      signals.push(signal);
      return new Promise((resolve) => waiting.set(q, resolve));
    },
  });
  const first = search.search("Pete", true),
    second = search.search("Peterson", true);
  assert.equal(signals[0].aborted, true);
  waiting.get("Peterson")({
    status: "ok",
    items: [{ address: b, name: "Peterson" }],
  });
  await second;
  waiting.get("Pete")({ status: "ok", items: [{ address: a, name: "Pete" }] });
  assert.equal(await first, null);
  assert.equal(search.snapshot().items[0].address, b);
});
test("results preserve ambiguous wallets, bound items, exclude invalid addresses, and distinguish unavailable", async () => {
  const s = createCollectorSearch({
    fetchResults: async () => ({
      status: "partial",
      items: [
        { address: a, name: "Pete" },
        { address: b, name: "Pete" },
        { address: "bad", name: "Pete" },
      ],
    }),
  });
  await s.search("Pete", true);
  assert.equal(s.snapshot().items.length, 2);
  const markup = collectorSearchMarkup(s.snapshot(), esc);
  assert.ok(markup.includes("#collector/" + a));
  assert.ok(markup.includes("#collector/" + b));
  assert.ok(markup.includes("Some identity sources could not be checked"));
  const failing = createCollectorSearch({
    fetchResults: async () => {
      throw Error("provider");
    },
  });
  await failing.search("Pete", true);
  assert.equal(failing.snapshot().status, "unavailable");
  assert.ok(
    collectorSearchMarkup(failing.snapshot(), esc).includes(
      "temporarily unavailable",
    ),
  );
});
test("collector markup escapes names and rejects unsafe avatar URLs", () => {
  const html = collectorSearchMarkup(
    {
      query: "Pete",
      status: "ok",
      items: [
        { address: a, name: "<img src=x>", avatarURL: "javascript:alert(1)" },
      ],
    },
    esc,
  );
  assert.ok(html.includes("&lt;img"));
  assert.ok(!html.includes("javascript:"));
});

test("ordinary music search hides successful empty collector matches but keeps ENS absence and failures", () => {
  assert.equal(
    collectorSearchMarkup({ query: "NOT4ME", status: "ok", items: [] }, esc),
    "",
  );
  assert.ok(
    collectorSearchMarkup(
      { query: "missing.eth", status: "ok", items: [] },
      esc,
    ).includes("No matching collector"),
  );
  assert.ok(
    collectorSearchMarkup(
      { query: "NOT4ME", status: "unavailable", items: [] },
      esc,
    ).includes("temporarily unavailable"),
  );
});
