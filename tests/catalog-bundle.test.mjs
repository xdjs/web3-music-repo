import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeCatalog, mediaKind } from "../src/catalog-bundle.mjs";
const contract = "0x" + "1".repeat(40);
const base = {
  id: "original",
  chainId: 1,
  contract,
  tokenId: "1",
  artist: "A",
  personIds: ["a", "pete"],
};
test("catalog expansion preserves IDs and credits, deduplicates same release media, retains shared-contract editions and other chains", () => {
  const items = [
    { ...base, id: "duplicate", tokenId: "2", creator: "creator" },
    { ...base, id: "edition", tokenId: "3" },
    { ...base, id: "otherchain", chainId: 10 },
  ];
  const out = mergeCatalog(
    [base],
    { original: { status: "live", mediaURI: "ipfs://one" } },
    [
      {
        records: items,
        evidence: {
          duplicate: { status: "live", mediaURI: "ipfs://one" },
          edition: { status: "live", mediaURI: "ipfs://two" },
          otherchain: { status: "live", mediaURI: "ipfs://one" },
        },
      },
    ],
    [{ id: "a", name: "A" }],
  );
  assert.deepEqual(
    out.records.map((r) => r.id),
    ["original", "edition", "otherchain"],
  );
  assert.deepEqual(out.records[0].personIds, ["a", "pete"]);
  assert.equal(out.records[0].creator, "creator");
});
test("artwork-only metadata is never presented as a recording", () => {
  assert.equal(
    mediaKind(
      { kind: "audio", imageURI: "ipfs://same" },
      { mediaURI: "ipfs://same" },
    ),
    "artwork",
  );
  assert.equal(
    mediaKind({ kind: "audio" }, { mediaURI: "ipfs://audio" }),
    "audio",
  );
});

test("confirmed aliases unite profiles while preserving original release attribution", () => {
  const record = {
    ...base,
    id: "alias-release",
    artist: "p3t3rango",
    tokenId: "8",
  };
  const out = mergeCatalog(
    [],
    {},
    [
      {
        records: [record],
        evidence: {
          "alias-release": { status: "live", mediaURI: "ipfs://music" },
        },
      },
    ],
    [{ id: "pete-rango", name: "Pete Rango", aliases: ["p3t3rango"] }],
  );
  assert.equal(out.people.length, 1);
  assert.equal(out.records[0].artistId, "pete-rango");
  assert.equal(out.records[0].artist, "p3t3rango");
  assert.deepEqual(out.records[0].personIds, ["pete-rango"]);
});

test("Solana mint identity preserves separate releases and survives compact presentation", async () => {
  const { indexRecord } = await import("../src/catalog-presentation.mjs");
  const mint = "122gW5E6uqWKEsb1KdCjVhWtarbCTdN7hR1bjt9dgdaw";
  const secondMint = "1278zxv5CugWLvq7SfV5822wkjtL5WKxMtDghiieg5Nd";
  const record = {
    id: "nina-a",
    chainId: "solana",
    mint,
    standard: "METAPLEX",
    artist: "Nina artist",
    artistId: "nina-artist",
    kind: "audio",
  };
  const other = { ...record, id: "nina-b", mint: secondMint };
  const duplicate = { ...record, id: "same-mint" };
  const evidence = Object.fromEntries(
    [record, other, duplicate].map((r) => [
      r.id,
      {
        status: "indexed",
        mediaURI: "ar://same-recording",
        mediaURL: "https://arweave.net/same-recording",
      },
    ]),
  );
  const merged = mergeCatalog(
    [],
    {},
    [{ records: [record, other, duplicate], evidence }],
    [{ id: "nina-artist", name: "Nina artist" }],
  );
  assert.deepEqual(
    merged.records.map((r) => r.id),
    ["nina-a", "nina-b"],
  );
  assert.equal(merged.records[0].mint, mint);
  assert.equal(merged.records[0].contract, undefined);
  assert.equal(merged.records[0].tokenId, undefined);
  assert.equal(indexRecord(merged.records[0], evidence[record.id]).mint, mint);
});
