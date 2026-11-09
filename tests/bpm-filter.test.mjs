import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeBpmRange,
  parseBpmBound,
  recordBpm,
  filterAndSortBpm,
  bpmTag,
} from "../src/bpm-filter.mjs";
import { createFilterPreferences } from "../src/filter-preferences.mjs";
const records = [
  { id: "unknown", musicFacts: { bpm: null } },
  {
    id: "estimate",
    musicFacts: {
      bpm: 120,
      source: "BPM estimated by Open BPM; tempo may be half or double.",
    },
  },
  { id: "source", musicFacts: { bpm: 120, source: "Original token metadata" } },
  { id: "slow", musicFacts: { bpm: 80.5 } },
  { id: "fast", musicFacts: { bpm: 160 } },
];
test("ranges support open inclusive bounds and normalize reversed/decimal values", () => {
  assert.deepEqual(normalizeBpmRange("160", "80.50"), {
    bpmMin: "80.5",
    bpmMax: "160",
    reordered: true,
  });
  assert.equal(filterAndSortBpm(records, { bpmMin: "120" }).length, 3);
  assert.deepEqual(
    filterAndSortBpm(records, { bpmMax: "80.5" }).map((r) => r.id),
    ["slow"],
  );
  assert.deepEqual(
    filterAndSortBpm(records, { bpmMin: "120", bpmMax: "120" }).map(
      (r) => r.id,
    ),
    ["estimate", "source"],
  );
});
test("invalid, nonfinite and out-of-range input cannot become a numeric query", () => {
  for (const v of [
    "NaN",
    "Infinity",
    "1e2",
    "0x80",
    "19",
    "401",
    "120bpm",
    "-100",
    {},
    120,
  ])
    assert.equal(parseBpmBound(v), null);
  assert.equal(normalizeBpmRange("wrong", "120"), null);
  assert.equal(parseBpmBound(""), "");
});
test("tempo sorts put unknowns last in both directions, break ties by ID and do not mutate input", () => {
  for (const sort of ["bpm-asc", "bpm-desc"]) {
    const out = filterAndSortBpm(records, { sort });
    assert.equal(out.at(-1).id, "unknown");
    assert.ok(
      out.findIndex((r) => r.id === "estimate") <
        out.findIndex((r) => r.id === "source"),
    );
  }
  assert.equal(filterAndSortBpm(records, { sort: "bpm-asc" })[0].id, "slow");
  assert.equal(filterAndSortBpm(records, { sort: "bpm-desc" })[0].id, "fast");
  assert.equal(records[0].id, "unknown");
});
test("compact facts and full-record metadata preserve source-vs-estimated labels", () => {
  assert.equal(bpmTag(records[1]).text, "~120 BPM");
  assert.equal(bpmTag(records[2]).text, "120 BPM");
  assert.equal(bpmTag(records[0]), null);
  assert.equal(
    recordBpm({
      musicMetadata: {
        bpms: [105],
        keys: [],
        sourceType: "spinamp-indexed-metadata",
      },
    }),
    105,
  );
  assert.equal(recordBpm({ musicFacts: { bpm: Infinity } }), null);
});
test("only Explore persists validated tempo bounds and sorting; reset leaves collection alone", () => {
  const data = new Map(),
    storage = () => ({
      getItem: (k) => data.get(k),
      setItem: (k, v) => data.set(k, v),
      removeItem: (k) => data.delete(k),
    });
  const p = createFilterPreferences("explore", { storage }),
    w = createFilterPreferences("collection", { storage });
  p.save({ bpmMin: "140", bpmMax: "100", sort: "bpm-desc" });
  assert.equal(p.load().bpmMin, "100");
  assert.equal(p.load().bpmMax, "140");
  assert.equal(p.load().sort, "bpm-desc");
  w.save({ bpmMin: "140", bpmMax: "100", sort: "bpm-desc", media: "audio" });
  assert.equal(w.load().bpmMin, undefined);
  assert.equal(w.load().sort, "archive");
  p.reset();
  assert.equal(p.load().bpmMin, "");
  assert.equal(w.load().media, "audio");
});
