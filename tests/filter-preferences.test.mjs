import test from "node:test";
import assert from "node:assert/strict";
import { createFilterPreferences } from "../src/filter-preferences.mjs";
function fixture() {
  const data = new Map();
  const storage = () => ({
    getItem: (k) => data.get(k),
    setItem: (k, v) => data.set(k, v),
    removeItem: (k) => data.delete(k),
  });
  const choices = () => ({
    platform: ["All", "Sound", "Nina"],
    network: ["1", "solana"],
    collection: ["CHAOS"],
  });
  return { data, storage, choices };
}
test("facet reload is isolated by surface and excludes queries, wallets and ownership", () => {
  const f = fixture();
  const explore = createFilterPreferences("explore", f),
    collection = createFilterPreferences("collection", f);
  explore.save({
    platform: "Nina",
    network: "solana",
    collection: "CHAOS",
    sort: "newest",
    query: "private search",
    address: "0xabc",
    myCollectionOnly: true,
    accountId: "private",
  });
  assert.deepEqual(explore.load(), {
    platform: "Nina",
    network: "solana",
    collection: "CHAOS",
    sort: "newest",
    media: "",
  });
  assert.equal(collection.load().platform, "");
  collection.save({ platform: "Sound", sort: "artist" });
  assert.equal(explore.load().platform, "Nina");
  assert.doesNotMatch(
    [...f.data.values()].join(),
    /private|0xabc|myCollectionOnly|query/,
  );
});
test("unknown catalog facets, invalid values, old schema and damaged storage return defaults", () => {
  const f = fixture(),
    p = createFilterPreferences("explore", f);
  p.save({
    platform: "unknown",
    network: "99999",
    media: "artwork",
    collection: "missing",
    sort: "script",
  });
  assert.deepEqual(p.load(), {
    platform: "All",
    network: "",
    media: "",
    collection: "",
    sort: "archive",
  });
  for (const raw of [
    "{",
    "null",
    "[]",
    JSON.stringify({ version: 8, values: { platform: "Sound" } }),
    "x".repeat(5000),
  ]) {
    f.data.set(p.key, raw);
    assert.equal(p.load().platform, "All");
  }
});
test("catalog changes validate old selections and reset removes only its own preferences", () => {
  const f = fixture(),
    p = createFilterPreferences("explore", f),
    w = createFilterPreferences("collection", f);
  p.save({ collection: "CHAOS", sort: "oldest" });
  w.save({ platform: "Sound" });
  const next = createFilterPreferences("explore", {
    ...f,
    choices: () => ({ collection: [] }),
  });
  assert.equal(next.load().collection, "");
  assert.equal(next.load().sort, "oldest");
  p.reset();
  assert.equal(p.load().sort, "archive");
  assert.equal(w.load().platform, "Sound");
});
test("denied localStorage getter/read/write/reset never blocks controls", () => {
  for (const storage of [
    () => {
      throw Error("SecurityError");
    },
    () => ({
      getItem() {
        throw Error("denied");
      },
      setItem() {
        throw Error("quota");
      },
      removeItem() {
        throw Error("denied");
      },
    }),
  ]) {
    const p = createFilterPreferences("collection", { storage });
    assert.equal(p.load().sort, "archive");
    assert.equal(p.save({ sort: "title" }).sort, "title");
    assert.equal(p.reset().sort, "archive");
  }
});
