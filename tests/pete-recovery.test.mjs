import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decodeAbiParameters } from "viem";
const read = (name) =>
  JSON.parse(
    readFileSync(
      new URL(`../data/pete-recovery/${name}.json`, import.meta.url),
    ),
  );
test("rush evidence pins contractURI and payout to the recorded Base block", () => {
  const e = read("rush-evidence");
  for (const request of e.requests) {
    assert.equal(parseInt(request.params[1], 16), e.blockNumber);
    assert.equal(request.params[0].to, e.contract);
  }
  const uri = e.responses.find((r) => r.id === "contractURI");
  assert.equal(
    decodeAbiParameters([{ type: "string" }], uri.result)[0],
    e.metadataURI,
  );
  assert.ok(
    e.attribution.linkedWallets.some(
      (w) =>
        w.walletAddress.toLowerCase() ===
        e.decoded.payoutRecipient.toLowerCase(),
    ),
  );
});
test("rush candidate preserves ERC20 semantics and identifies the recovered asset as a clip", () => {
  const c = read("rush-candidate");
  const e = read("rush-evidence");
  const m = read("rush-metadata");
  assert.equal(c.record.standard, "ERC20");
  assert.equal(c.record.tokenId, null);
  assert.equal(c.record.mediaScope, "clip");
  assert.equal(c.evidence.mediaURI, m.animation_url);
  assert.equal(c.record.durationSeconds, Number(e.media.probe.format.duration));
  assert.ok(e.media.probe.streams.some((s) => s.codec_type === "audio"));
  assert.equal(c.integrationStatus, "review-required-erc20-support");
});

import { readNFT } from "../src/nft-reader.mjs";
import { readOwner } from "../src/recovery-owner.mjs";
import { encodeAbiParameters } from "viem";

test("ERC20 reread uses contractURI at one fixed block and preserves the video clip scope", async () => {
  const candidate = read("rush-candidate");
  const source = read("rush-metadata");
  const requests = [];
  const value = await readNFT(candidate.record, async (url, options) => {
    if (options.method === "POST") {
      const request = JSON.parse(options.body);
      requests.push(request);
      return Response.json({
        result:
          request.method === "eth_blockNumber"
            ? "0x123"
            : encodeAbiParameters(
                [{ type: "string" }],
                [candidate.evidence.metadataURI],
              ),
      });
    }
    assert.equal(
      url,
      "https://ipfs.filebase.io/ipfs/" +
        candidate.evidence.metadataURI.slice(7),
    );
    return Response.json(source);
  });
  assert.equal(value.status, "live");
  assert.equal(value.standard, "ERC20");
  assert.equal(value.tokenId, null);
  assert.equal(value.kind, "video");
  assert.equal(value.mediaScope, "clip");
  assert.equal(value.durationSeconds, 20.633333);
  assert.equal(value.mediaURI, source.animation_url);
  assert.equal(value.blockNumber, 291);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].params[0].data, "0xe8a3d485");
  assert.equal(requests[1].params[1], "0x123");
  assert.equal(
    value.metadataLocation,
    "ERC20 contractURI() → storage metadata",
  );
});

test("ERC20 ownership never calls ownerOf and has no NFT owner", async () => {
  let calls = 0;
  const result = await readOwner(read("rush-candidate").record, async () => {
    calls++;
  });
  assert.equal(calls, 0);
  assert.equal(result.status, "unsupported");
  assert.match(result.message, /fungible/);
  assert.equal(result.address, undefined);
});

test("unknown standards, invented coin token IDs and out-of-range NFT IDs never reach RPC", async () => {
  const candidate = read("rush-candidate").record;
  const invalid = [
    { ...candidate, standard: "ERC777" },
    { ...candidate, standard: "" },
    { ...candidate, standard: null },
    { ...candidate, tokenId: "0" },
    { ...candidate, tokenId: undefined },
    { ...candidate, standard: "ERC721", tokenId: null },
    { ...candidate, standard: "ERC721", tokenId: (1n << 256n).toString() },
  ];
  for (const record of invalid) {
    const result = await readNFT(record, async () => {
      assert.fail("invalid input reached RPC");
    });
    assert.equal(result.status, "unavailable");
  }
  for (const standard of ["ERC777", "", null]) {
    const result = await readOwner({ ...candidate, standard }, async () => {
      assert.fail("unsupported standard reached RPC");
    });
    assert.equal(result.status, "unsupported");
  }
});

import { readHolders } from "../src/recovery-holders.mjs";
test("coin balances never enter the NFT holder adapter", async () => {
  const value = await readHolders(
    read("rush-candidate").record,
    null,
    async () => assert.fail("coin reached NFT holder index"),
  );
  assert.equal(value.status, "unsupported");
  assert.equal(value.scope, "coin");
  assert.equal(value.items, undefined);
});
