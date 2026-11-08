import { musicFacts } from "../src/music-facts.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeCatalog, createCatalogLoader } from "../src/catalog-bundle.mjs";
import {
  isIndexedRelease,
  hasTokenIdentity,
} from "../src/asset-capabilities.mjs";
import { assetIdentityKey } from "../src/solana-identity.mjs";
import { readNFT } from "../src/nft-reader.mjs";
import { readOwner } from "../src/recovery-owner.mjs";
import {
  readHolders,
  readTokenHolders,
  readMediaHolders,
} from "../src/recovery-holders.mjs";
import { readCollectors } from "../src/recovery-collectors.mjs";
import { readWalletPage } from "../src/wallet-library.mjs";
import { recoverySummary } from "../src/recovery-model.mjs";
import { indexRecord } from "../src/catalog-presentation.mjs";
import { releaseDateForRecord } from "../src/release-date.mjs";
import { renderIndexedReleaseProvenance } from "../src/indexed-release-ui.mjs";
import { mountCollectors } from "../src/collectors-ui.mjs";
const release = {
  id: "spinamp-unlinked",
  artist: "Artist",
  artistId: "a",
  title: "Title",
  assetType: "indexed-release",
  mintStatus: "unconfirmed",
  indexedNetwork: "base",
  spinampTrackId: "base/preserved-id",
  platform: "Sound",
  kind: "audio",
};
const ev = {
  status: "indexed",
  source: "https://api.spinamp.xyz/v3/graphql",
  sourceType: "spinamp-track-index",
  mediaSourceType: "spinamp-preserved-audio",
  mediaURI: "ipfs://music",
  mediaURL: "https://example.com/music.mp3",
};
const people = [{ id: "a", name: "Artist", spinampArtistId: "exact-a" }];
const linked = {
  id: release.id,
  title: release.title,
  artist: release.artist,
  artistId: "a",
  chainId: 8453,
  contract: "0x" + "1".repeat(40),
  tokenId: "1",
  standard: "ERC721",
};
const bundle = (r, v = ev) => ({ records: [r], evidence: { [r.id]: v } });
test("index-only records do not collapse by null identity or shared audio", () => {
  const r2 = { ...release, id: "another" };
  const b = mergeCatalog([], {}, [bundle(release), bundle(r2)], people);
  assert.equal(b.records.length, 2);
  assert.equal(assetIdentityKey(release), null);
  assert.equal(hasTokenIdentity(release), false);
});
test("stable index ID promotes to token identity in either dataset order without duplicate playlist IDs", () => {
  for (const bundles of [
    [bundle(release), bundle(linked)],
    [bundle(linked), bundle(release)],
  ]) {
    const b = mergeCatalog([], {}, bundles, people);
    assert.equal(b.records.length, 1);
    assert.equal(b.records[0].id, release.id);
    assert.equal(isIndexedRelease(b.records[0]), false);
    assert.equal(hasTokenIdentity(b.records[0]), true);
    assert.equal(b.records[0].mintStatus, undefined);
  }
});
test("all chain/collector entry points reject index-only identity before any provider call", async () => {
  let calls = 0;
  const fetcher = () => {
    calls++;
    throw Error("unexpected provider request");
  };
  for (const result of await Promise.all([
    readNFT(release, fetcher),
    readOwner(release, fetcher),
    readHolders(release, null, fetcher),
    readTokenHolders(release, null, fetcher),
    readMediaHolders(release, null, fetcher),
    readCollectors(release, null, new Map(), fetcher),
  ])) {
    assert.equal(result.status, "unsupported");
    assert.equal(result.scope, "unconfirmed-mint");
    assert.match(result.message, /not been established/);
  }
  assert.equal(calls, 0);
});
test("wallet matching cannot attribute a provider NFT to an index-only recording", async () => {
  const fetcher = async () => ({
    ok: true,
    text: async () =>
      JSON.stringify({
        items: [
          {
            token: { address_hash: linked.contract },
            id: "1",
            value: "1",
            token_type: "ERC-721",
          },
        ],
      }),
  });
  const out = await readWalletPage(
    "0x" + "2".repeat(40),
    8453,
    null,
    [release],
    new Map(),
    fetcher,
  );
  assert.equal(out.status, "indexed");
  assert.equal(out.items[0].recordId, null);
});
test("compact catalog preserves capability and source label; summary excludes index-only from chain reads", () => {
  const out = indexRecord(release, ev);
  assert.equal(out.assetType, "indexed-release");
  assert.equal(out.mintStatus, "unconfirmed");
  assert.equal(out.chainId, undefined);
  assert.equal(out.recovery.mediaSourceType, "spinamp-preserved-audio");
  const s = recoverySummary([release, linked], { [release.id]: ev });
  assert.equal(s.indexOnly, 1);
  assert.equal(s.indexed, 1);
  assert.deepEqual(s.chains, ["Base"]);
});
test("index timestamp does not become a mint or artist release date", () => {
  const r = {
    ...release,
    indexedSourceDate: {
      kind: "index-record-created",
      date: "2024-01-01T00:00:00Z",
      source: ev.source,
      onchainVerified: false,
    },
  };
  const d = releaseDateForRecord(r);
  assert.equal(d.label, "Added to Spinamp index");
  assert.equal(d.kind, "index-record-created");
});
test("proof and collectors reuse existing UI without token actions, explorer guesses or empty-holder claim", async () => {
  const escape = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll('"', "&quot;");
  const html = renderIndexedReleaseProvenance(
    { ...release, recovery: ev },
    escape,
  );
  assert.match(html, /NFT identity not established/);
  assert.match(html, /Spinamp preserved audio/);
  assert.doesNotMatch(
    html,
    /data-recover|\/token\/|Original contract|undefined/,
  );
  const priorDocument = globalThis.document;
  globalThis.document = { addEventListener() {} };
  const ui = mountCollectors({
    esc: escape,
    short: (s) => s,
    date: (s) => s,
    explorers: {},
    chainNames: {},
    catalog: () => [release],
    recordLink: (r) => "#record/" + r.id,
    rerender: () => {
      throw Error("unexpected rerender");
    },
  });
  assert.match(ui.panel(release, true), /Collectors not yet linked/);
  await ui.load(release.id);
  globalThis.document = priorDocument;
});
test("admitted candidate cannot receive token finance or inferred chain fields", () => {
  const b = createCatalogLoader()();
  const rows = b.records.filter(isIndexedRelease);
  // Candidate data is optional until the reviewed index cohort is integrated.
  for (const r of rows) {
    assert.equal(assetIdentityKey(r), null);
    assert.equal(r.chainId, undefined);
    assert.equal(r.contract, undefined);
    assert.equal(r.tokenId, undefined);
    assert.equal(r.mint, undefined);
    assert.equal(r.revenue, null);
    assert.deepEqual(r.royaltyPayments, []);
  }
  assert.equal(b.records.length, new Set(b.records.map((r) => r.id)).size);
});

test("promotion clears provisional facts and holds when the exact NFT already has another stable ID", () => {
  const provisional = {
    ...release,
    mediaTypeProvisional: true,
    indexedSourceDate: { date: "2020-01-01" },
    musicMetadata: { sourceType: "spinamp-track-index" },
  };
  const upgraded = mergeCatalog(
    [],
    {},
    [bundle(provisional), bundle(linked)],
    people,
  ).records[0];
  assert.equal(upgraded.mediaTypeProvisional, undefined);
  assert.equal(upgraded.indexedSourceDate, undefined);
  assert.equal(upgraded.musicMetadata, undefined);
  const existing = { ...linked, id: "established-token" };
  const out = mergeCatalog(
    [existing],
    { [existing.id]: ev },
    [bundle(provisional), bundle(linked)],
    people,
  );
  assert.equal(out.records.length, 2);
  assert.equal(out.records.filter(hasTokenIdentity).length, 1);
  assert.equal(
    isIndexedRelease(out.records.find((r) => r.id === release.id)),
    true,
  );
});

test("index-only marker cannot inherit an accidental token identity", () => {
  assert.equal(
    assetIdentityKey({ ...linked, assetType: "indexed-release" }),
    null,
  );
});

test("future music facts supplied by the track index are never labeled original token metadata", () => {
  const facts = musicFacts({
    ...release,
    musicMetadata: { sourceType: "spinamp-track-index", bpms: [120], keys: [] },
  });
  assert.equal(facts.bpm, 120);
  assert.match(facts.source, /Spinamp indexed metadata/);
});
