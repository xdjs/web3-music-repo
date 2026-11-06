import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const load = (p) =>
  JSON.parse(
    readFileSync(new URL("../data/pete-recovery/" + p, import.meta.url)),
  );
const bundle = load("zora-recovered-media.json"),
  reads = load("zora-collection-reads.json").collections,
  metadata = load("zora-original-metadata.json"),
  media = load("zora-media-verification.json").results;
test("every proposed music record has exact fixed-block NFT metadata and decoded audio playback", () => {
  assert.equal(bundle.records.length, 6);
  for (const r of bundle.records.filter((r) =>
    reads.some((c) => c.contract === r.contract),
  )) {
    const c = reads.find(
      (c) => c.chainId === r.chainId && c.contract === r.contract,
    );
    assert.equal(c.calls.find((x) => x.name === "supports721").decoded, true);
    assert.equal(r.standard, "ERC721");
    assert.equal(r.tokenId, "1");
    const e = bundle.evidence[r.id];
    assert.equal(e.blockNumber, parseInt(c.block, 16));
    assert.equal(
      e.metadataURI,
      c.calls.find((x) => x.name === "tokenURI1").decoded,
    );
    assert.equal(e.mediaURI, metadata[r.contract].animation_url);
    const v = media.find((x) => x.contract === r.contract);
    assert.equal(v.status, "played");
    assert.ok(v.audioDecodedBytes > 0);
    assert.ok(v.currentTime > 0.5);
  }
});
test("all Savage Planet visualizers retain named original credits rather than treating cover images as songs", () => {
  const records = bundle.records.filter(
    (r) => r.collection === "Savage Planet",
  );
  assert.equal(records.length, 3);
  for (const r of records) {
    assert.equal(r.kind, "video");
    assert.notEqual(bundle.evidence[r.id].mediaURI, r.imageURI);
    assert.match(
      metadata[r.contract].description,
      /Creative Direction and Production by Xmane and Pete Rango/,
    );
    assert.match(
      metadata[r.contract].description,
      /3D [Aa]nimation: Nawt Creative/,
    );
    assert.deepEqual(
      r.credits.map((c) => c.personId),
      ["pete-rango", "xmane", "nawt-creative"],
    );
  }
});
test("image-only Keepers token metadata does not enter music catalog", () => {
  const keepers = load("keepers-metadata.json");
  assert.equal(keepers.length, 15);
  assert.ok(
    keepers.every(
      (r) => r.metadata?.image && !r.metadata?.animation_url && !r.error,
    ),
  );
  assert.ok(!bundle.records.some((r) => r.chainId === 8453));
});

test("holdings discoveries retain exact NFT evidence, credits and qualified platform attribution", () => {
  const originals = load("holdings-priority-reads.json"),
    plays = load("holdings-media-verification.json").results;
  for (const x of originals) {
    const r = bundle.records.find(
      (r) =>
        r.contract === x.item.contractAddress && r.tokenId === x.item.tokenId,
    );
    assert.ok(r);
    assert.equal(x.reads.find((x) => x.name === "supports721").decoded, true);
    assert.equal(
      bundle.evidence[r.id].metadataURI,
      x.reads.find((x) => x.name === "tokenURI").decoded,
    );
    assert.equal(bundle.evidence[r.id].mediaURI, x.metadata.animation_url);
    const p = plays.find((p) => p.contract === r.contract);
    assert.equal(p.status, "played");
    assert.ok(p.currentTime > 0.5 && p.audioDecodedBytes > 0);
    assert.ok(r.credits.some((c) => c.personId === "pete-rango"));
  }
  const say = bundle.records.find((r) => r.title === "Say it celly");
  assert.equal(say.artist, "Mavi Taylor");
  assert.ok(
    load(
      "say-it-creator-zora.json",
    ).body.data.profile.profileZoraPosts.edges.some(
      (x) =>
        x.node.address === say.contract &&
        x.node.creatorProfile.profileId === "mavi_taylor",
    ),
  );
  assert.equal(
    bundle.records.find((r) => r.title.startsWith("Evermore DEMO")).platform,
    "Other",
  );
});
