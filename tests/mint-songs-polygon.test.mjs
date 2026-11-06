import test from "node:test";
import assert from "node:assert/strict";
import { encodeAbiParameters } from "viem";
import {
  decodeMintSongsPolygon,
  mintSongsPolygonBundle,
  MINT_SONGS_POLYGON,
} from "../src/mint-songs-polygon.mjs";
const media = "ipfs://QmQVPTbUxaMFtzqvYwpdRVCmVcb66PzyxGDxFBicNnsBE3";
const raw = (text) =>
  encodeAbiParameters(
    [{ type: "string" }],
    [`data:application/json;base64,${Buffer.from(text).toString("base64")}`],
  );
const metadata = {
  name: "Song by Artist",
  animation_url: media,
  attributes: [
    { trait_type: "Song", value: "Song" },
    { trait_type: "Artist", value: "Artist" },
    { trait_type: "Song Number", value: 20 },
    { trait_type: "Edition Number", value: 1 },
    { trait_type: "Edition Count", value: 50 },
  ],
};
const sample = (tokenId) => ({
  tokenId,
  rpcResponse: { result: raw(JSON.stringify(metadata)) },
  mediaCheck: { status: 200, uri: media, contentType: "audio/wav" },
});
const discovery = (samples) => ({
  chainId: 137,
  contract: MINT_SONGS_POLYGON,
  referenceBlock: 96831910,
  samples,
});
test("Polygon editions collapse by original song number and exact media, retaining observed token identities", () => {
  const result = mintSongsPolygonBundle(discovery([sample("1"), sample("2")]));
  assert.equal(result.bundle.records.length, 1);
  assert.deepEqual(result.bundle.records[0].observedTokenIds, ["1", "2"]);
  assert.equal(result.bundle.records[0].editionSupply, 50);
  assert.equal(
    result.bundle.evidence[result.bundle.records[0].id].status,
    "indexed",
  );
});
test("Polygon malformed original JSON remains unresolved and test/audio-unverified records are excluded", () => {
  assert.throws(() => decodeMintSongsPolygon(raw('{"name":"broken"title"}')));
  const testMetadata = structuredClone(metadata);
  testMetadata.attributes[0].value = "test";
  const result = mintSongsPolygonBundle(
    discovery([
      { ...sample("1"), rpcResponse: { result: raw('{"name":"bad\njson"}') } },
      {
        ...sample("2"),
        rpcResponse: { result: raw(JSON.stringify(testMetadata)) },
      },
      {
        ...sample("3"),
        mediaCheck: { status: 200, uri: media, contentType: "text/html" },
      },
    ]),
  );
  assert.equal(result.bundle.records.length, 0);
  assert.equal(result.report.unresolved.length, 1);
  assert.deepEqual(result.report.testTokens, ["2"]);
  assert.deepEqual(result.report.mediaUnverified, ["3"]);
});
test("Polygon refuses different contract and keeps contradictory editions unresolved", () => {
  assert.throws(() => mintSongsPolygonBundle({ ...discovery([]), chainId: 1 }));
  const changed = structuredClone(metadata);
  changed.attributes[1].value = "Different artist";
  const result = mintSongsPolygonBundle(
    discovery([
      sample("1"),
      { ...sample("2"), rpcResponse: { result: raw(JSON.stringify(changed)) } },
    ]),
  );
  assert.equal(result.report.unresolved.length, 1);
});
