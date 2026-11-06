import test from "node:test";
import assert from "node:assert/strict";
import { encodeAbiParameters } from "viem";
import {
  mintSongsBundle,
  mintSongsIPFS,
  MINT_SONGS_V2,
} from "../src/mint-songs.mjs";
const cid = "QmPtouUjCVfZ3g7qNEZsF5CHWtB92SREqZjjNmeg5MNLVy";
const row = {
  metadata: {
    contract: { address: MINT_SONGS_V2 },
    tokenId: "7",
    block: { number: "14806547" },
    tokenURI: `https://old-gateway.test/ipfs/${cid}`,
  },
  results: {
    title: "Driving",
    artist: "WYMN",
    losslessAudio: `ipfs://${cid}`,
    mimeType: "audio/wav",
    bpm: null,
    key: null,
    duration: 214,
    credits: [{ name: "WYMN", collaboratorType: "creator" }],
  },
};
const call = {
  metadata: row.metadata,
  results: encodeAbiParameters([{ type: "string" }], [`ipfs://${cid}`]),
};
test("Mint Songs snapshot keeps null tempo unknown and preserves explicitly typed credits", () => {
  const { bundle, report } = mintSongsBundle([row, row], [call], "2026-11-06");
  assert.equal(report.uniqueTokens, 1);
  assert.equal(report.duplicateRows, 1);
  assert.equal(report.originalBPM, 0);
  assert.equal(report.originalKeys, 0);
  assert.equal(bundle.evidence[bundle.records[0].id].status, "indexed");
  assert.deepEqual(bundle.records[0].musicMetadata.credits, ["WYMN — creator"]);
  assert.equal(bundle.records[0].creator, undefined);
});
test("Mint Songs rejects wrong contracts, missing chain references, and conflicting duplicate metadata", () => {
  assert.throws(() =>
    mintSongsBundle(
      [
        {
          ...row,
          metadata: { ...row.metadata, contract: { address: "0xdead" } },
        },
      ],
      [call],
      "now",
    ),
  );
  assert.throws(() => mintSongsBundle([row], [], "now"));
  assert.throws(() =>
    mintSongsBundle(
      [row, { ...row, results: { ...row.results, title: "Changed" } }],
      [call],
      "now",
    ),
  );
});
test("Mint Songs URI normalization trims historical trailing space without accepting arbitrary websites", () => {
  assert.equal(mintSongsIPFS(`ipfs://${cid} `), `ipfs://${cid}`);
  assert.equal(mintSongsIPFS("https://example.com/music.wav"), null);
  assert.equal(mintSongsIPFS("ipfs://bad cid"), null);
});
