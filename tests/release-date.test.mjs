import test from "node:test";
import assert from "node:assert/strict";
import {
  parseHistoricalDate,
  releaseDateForRecord,
  compareReleaseDates,
} from "../src/release-date.mjs";
const record = {
  id: "song",
  platform: "Sound",
  chainId: 1,
  contract: "0xABC",
  tokenId: "9007199254740993123",
};
test("historical date parser rejects ambiguous locale and impossible dates", () => {
  for (const value of [
    "06/03/2022",
    "01/08/2023",
    "2022-02-30",
    "2023-02-29",
    "2022-13-01",
    "2022-01-01T25:00:00Z",
    "2022-01-01T10:00:00",
    1672531200,
  ])
    assert.equal(parseHistoricalDate(value), null);
  assert.equal(
    parseHistoricalDate("2024-02-29").date,
    "2024-02-29T00:00:00.000Z",
  );
  assert.equal(
    parseHistoricalDate("2023-10-15T18:17:35.000000Z").date,
    "2023-10-15T18:17:35.000Z",
  );
  assert.equal(
    parseHistoricalDate("2023-01-01T01:00:00+01:00").date,
    "2023-01-01T00:00:00.000Z",
  );
});
test("date attachment uses exact token identity and excludes artist-wide deployment dates", () => {
  const index = {
    tokens: {
      "1:0xabc:9007199254740993123": {
        date: "2022-01-01",
        kind: "token-created",
      },
    },
    contracts: {
      "1:0xabc": { date: "2021-01-01", kind: "release-contract-created" },
    },
  };
  assert.equal(releaseDateForRecord(record, index).kind, "token-created");
  assert.equal(
    releaseDateForRecord({ ...record, tokenId: "9" }, index).kind,
    "release-contract-created",
  );
  assert.equal(
    releaseDateForRecord(
      { ...record, tokenId: "9", legacyEditionId: "3" },
      index,
    ),
    null,
  );
  assert.equal(releaseDateForRecord({ ...record, chainId: 10 }, index), null);
  assert.equal(
    releaseDateForRecord(
      { ...record, tokenId: "9" },
      {
        contracts: {
          "1:0xabc": { date: "2021-01-01", kind: "artist-contract" },
        },
      },
    ),
    null,
  );
});
test("recovery dates never become release dates and conflicting supplied dates stay unknown", () => {
  assert.equal(
    releaseDateForRecord({
      ...record,
      checkedAt: "2026-11-06",
      createdAt: "2026-11-06",
      audioAnalysis: { checkedAt: "2026-11-06" },
    }),
    null,
  );
  assert.equal(
    releaseDateForRecord({
      ...record,
      musicMetadata: {
        details: { "Release date": ["2022-01-01", "2023-01-01"] },
      },
    }),
    null,
  );
});
test("oldest and newest ordering keep unknown dates last with deterministic ties", () => {
  const records = [
    { id: "unknown" },
    { id: "late", releaseDate: { timestamp: 20 } },
    { id: "early", releaseDate: { timestamp: 10 } },
  ];
  assert.deepEqual(
    [...records]
      .sort((a, b) => compareReleaseDates(a, b, "oldest"))
      .map((r) => r.id),
    ["early", "late", "unknown"],
  );
  assert.deepEqual(
    [...records].sort(compareReleaseDates).map((r) => r.id),
    ["late", "early", "unknown"],
  );
});

test("indexed NFT creation remains attributed and cannot replace stronger historical dates", () => {
  const indexed = {
    ...record,
    indexedNftCreation: {
      date: "2023-10-15T18:17:35.000000Z",
      source: "https://api.spinamp.xyz/v3/graphql",
      onchainVerified: false,
    },
  };
  const date = releaseDateForRecord(indexed);
  assert.equal(date.kind, "indexed-token-created");
  assert.equal(date.date, "2023-10-15T18:17:35.000Z");
  assert.equal(date.onchainVerified, false);
  assert.match(date.label, /Spinamp index/);
  assert.equal(
    releaseDateForRecord({
      ...indexed,
      musicMetadata: { details: { "Release date": ["2022-01-01"] } },
    }).kind,
    "release-metadata",
  );
  assert.equal(
    releaseDateForRecord(indexed, {
      tokens: {
        "1:0xabc:9007199254740993123": {
          date: "2021-01-01",
          kind: "token-created",
        },
      },
    }).kind,
    "token-created",
  );
  assert.equal(
    releaseDateForRecord({
      ...indexed,
      indexedNftCreation: { ...indexed.indexedNftCreation, date: "2023-02-30" },
    }),
    null,
  );
  assert.equal(
    releaseDateForRecord({
      ...indexed,
      indexedNftCreation: {
        ...indexed.indexedNftCreation,
        source: "https://example.com",
      },
    }),
    null,
  );
});
