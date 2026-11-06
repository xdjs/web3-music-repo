import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCatalogLoader } from "../src/catalog-bundle.mjs";
import { indexRecord } from "../src/catalog-presentation.mjs";

test("triunfo producer attestation adds Pete relationship while preserving exact mint artist and identity", () => {
  const id = "spinamp-1c68061e5fc9d737da8a";
  const source = JSON.parse(readFileSync("data/spinamp/recovered-media.json"));
  const raw = source.records.find((r) => r.id === id),
    catalog = createCatalogLoader()(),
    record = catalog.records.find((r) => r.id === id);
  assert.equal(record.title, "triunfo");
  assert.equal(record.artist, "xueniversal.eth");
  for (const field of [
    "artist",
    "artistId",
    "spinampArtistId",
    "chainId",
    "contract",
    "tokenId",
    "originalRelease",
  ])
    assert.equal(record[field], raw[field]);
  const credits = record.credits.filter(
    (c) => c.personId === "pete-rango" && c.role === "Producer",
  );
  assert.equal(credits.length, 1);
  assert.equal(credits[0].sourceType, "artist-attestation");
  assert.equal(credits[0].attestedAt, "2026-11-06");
  assert.equal(credits[0].source, null);
  assert.deepEqual(credits[0].recordIdentity, {
    chainId: record.chainId,
    contract: record.contract,
    tokenId: record.tokenId,
  });
  assert.ok(record.personIds.includes("pete-rango"));
  assert.ok(record.personIds.includes(raw.artistId));
  assert.ok(
    indexRecord(record, catalog.evidence[id]).personIds.includes("pete-rango"),
  );
  assert.deepEqual(catalog.evidence[id], source.evidence[id]);
  assert.equal(
    raw.credits?.some((c) => c.personId === "pete-rango") || false,
    false,
    "original indexed bundle is not rewritten",
  );
  const attested = catalog.records.filter((r) =>
    r.credits?.some(
      (c) =>
        c.personId === "pete-rango" &&
        c.sourceType === "artist-attestation" &&
        c.attestedAt === "2026-11-06",
    ),
  );
  assert.deepEqual(
    attested.map((r) => r.id),
    [id],
    "this attestation must not merge an entire minting wallet",
  );
});
