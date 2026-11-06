import test from "node:test";
import assert from "node:assert/strict";
import {
  filterCollectionRecords,
  collectionSelect,
} from "../src/collection-filters.mjs";
const records = [
  {
    id: "a",
    title: "Zulu",
    artist: "Pete",
    platform: "Sound",
    chainId: 1,
    kind: "audio",
    collection: "One",
  },
  {
    id: "b",
    title: "Alpha",
    artist: "Xmane",
    platform: "Zora",
    chainId: 8453,
    kind: "video",
    collection: "Two",
  },
  {
    id: "c",
    title: "Echo",
    artist: "Pete",
    platform: "Zora",
    chainId: 1,
    kind: "audio",
    collection: "Two",
  },
];
test("collection filters intersect and sorting does not alter input or invent matches", () => {
  assert.deepEqual(
    filterCollectionRecords(records, {
      query: "pete",
      platform: "Zora",
      network: "1",
      media: "audio",
      collection: "Two",
      sort: "title",
    }).map((r) => r.id),
    ["c"],
  );
  assert.deepEqual(
    filterCollectionRecords(records, { sort: "title" }).map((r) => r.id),
    ["b", "c", "a"],
  );
  assert.deepEqual(
    records.map((r) => r.id),
    ["a", "b", "c"],
  );
  assert.deepEqual(filterCollectionRecords(records, { network: "solana" }), []);
});
test("shared select escapes values and retains current selection", () => {
  const esc = (s) =>
    String(s)
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;");
  const result = collectionSelect(
    esc,
    "collection",
    "Collection",
    [
      ["", "All collections"],
      ['"<', "Unsafe <"],
    ],
    '"<',
    "data-wallet-filter",
  );
  assert.ok(result.includes('data-wallet-filter="collection"'));
  assert.ok(result.includes('value="&quot;&lt;" selected'));
  assert.ok(result.includes("Unsafe &lt;"));
});
