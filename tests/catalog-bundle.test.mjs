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
