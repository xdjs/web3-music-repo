import test from "node:test";
import assert from "node:assert/strict";
import { readNFT, storageURL, decodeString } from "../src/nft-reader.mjs";
const r = {
  chainId: 1,
  contract: "0x" + "a".repeat(40),
  tokenId: "1",
  kind: "audio",
};
const encode = (s) =>
  "0x" +
  (32).toString(16).padStart(64, "0") +
  Buffer.byteLength(s).toString(16).padStart(64, "0") +
  Buffer.from(s)
    .toString("hex")
    .padEnd(Math.ceil(Buffer.byteLength(s) / 32) * 64, "0");
test("contract metadata is resolved at one block and only public media fields leave the adapter", async () => {
  const calls = [];
  const meta = {
    name: "A recording",
    animation_url: "ipfs://bafytest/song.wav",
    description: "private unneeded payload",
    image: "ar://cover",
  };
  const uri =
    "data:application/json;base64," +
    Buffer.from(JSON.stringify(meta)).toString("base64");
  const f = async (url, opts) => {
    const body = JSON.parse(opts.body);
    calls.push(body);
    return Response.json({
      result: body.method === "eth_blockNumber" ? "0x123" : encode(uri),
    });
  };
  const v = await readNFT(r, f);
  assert.equal(v.status, "live");
  assert.equal(v.blockNumber, 291);
  assert.equal(calls[1].params[1], "0x123");
  assert.equal(v.mediaURL, "https://ipfs.filebase.io/ipfs/bafytest/song.wav");
  assert.equal(v.description, undefined);
  assert.equal(v.metadataURL, null);
});
test("rejects arbitrary hosts, credentials, local addresses and malformed ABI results", () => {
  for (const u of [
    "http://127.0.0.1/x",
    "https://arweave.net@127.0.0.1/x",
    "https://evil.test/x",
    "ipfs://../x",
    "javascript:alert(1)",
  ])
    assert.throws(() => storageURL(u));
  assert.throws(() => decodeString("0x00"));
});
test("contract failure remains unavailable and cannot masquerade as verified media", async () => {
  const v = await readNFT(r, async () =>
    Response.json({ error: { message: "timeout" } }),
  );
  assert.equal(v.status, "unavailable");
  assert.equal(v.mediaURL, undefined);
});
test("a storage redirect to an unapproved host is rejected before a second request", async () => {
  let count = 0;
  const f = async (url, opts) => {
    count++;
    if (opts.method === "POST") {
      const body = JSON.parse(opts.body);
      return Response.json({
        result:
          body.method === "eth_blockNumber" ? "0x123" : encode("ar://metadata"),
      });
    }
    return new Response("", {
      status: 302,
      headers: { location: "http://127.0.0.1/private" },
    });
  };
  assert.equal((await readNFT(r, f)).status, "unavailable");
  assert.equal(count, 3);
});

test("IPFS gateway URLs resolve by content address without trusting the supplied host", () => {
  assert.equal(
    storageURL("https://old-gateway.example/ipfs/QmKnown/file.mp3"),
    "https://ipfs.filebase.io/ipfs/QmKnown/file.mp3",
  );
});

test("Arpeggi metadata permission is limited to its kit contract route", () => {
  assert.equal(
    storageURL(
      "https://www.arpeggi.io/api/v2/kits-metadata/0x93382a4334518596741343ce5ff93fb843e9be2d/8",
    ),
    "https://www.arpeggi.io/api/v2/kits-metadata/0x93382a4334518596741343ce5ff93fb843e9be2d/8",
  );
  assert.throws(() => storageURL("https://www.arpeggi.io/api/other"));
});

test("legacy Zora records read metadata separately from the media at the same block", async () => {
  const calls = [];
  const meta = {
    body: {
      title: "Original record",
      artwork: { info: { uri: "ipfs://cover" } },
    },
  };
  const data =
    "data:application/json;base64," +
    Buffer.from(JSON.stringify(meta)).toString("base64");
  const fetcher = async (url, opts) => {
    const b = JSON.parse(opts.body);
    calls.push(b);
    return Response.json({
      result:
        b.method === "eth_blockNumber"
          ? "0x123"
          : encode(
              b.params[0].data.startsWith("0x157c3df9")
                ? data
                : "ipfs://QmRecording/record.wav",
            ),
    });
  };
  const value = await readNFT(
    { ...r, contract: "0xabEFBc9fD2F806065b4f3C237d4b59D9A97Bcac7" },
    fetcher,
  );
  assert.equal(value.status, "live");
  assert.equal(value.title, "Original record");
  assert.equal(value.mediaURI, "ipfs://QmRecording/record.wav");
  assert.equal(calls[1].params[1], calls[2].params[1]);
  assert.equal(value.imageURL, "https://ipfs.filebase.io/ipfs/cover");
});

test("multi-chain reads use fixed RPC hosts and ERC1155 uses uri(uint256)", async () => {
  for (const chainId of [10, 8453, 7777777]) {
    const seen = [];
    const uri =
      "data:application/json;base64," +
      Buffer.from(
        JSON.stringify({ name: "Song", animation_url: "ar://song" }),
      ).toString("base64");
    const result = await readNFT(
      { ...r, chainId, standard: "ERC1155" },
      async (url, options) => {
        const body = JSON.parse(options.body);
        seen.push({ url, body });
        return Response.json({
          result: body.method === "eth_blockNumber" ? "0x123" : encode(uri),
        });
      },
    );
    assert.equal(result.chainId, chainId);
    assert.equal(result.status, "live");
    assert.ok(seen[1].body.params[0].data.startsWith("0x0e89341c"));
    assert.ok(seen.every((x) => x.url === seen[0].url));
  }
  let requested = false;
  assert.equal(
    (
      await readNFT({ ...r, chainId: 999 }, async () => {
        requested = true;
      })
    ).status,
    "unavailable",
  );
  assert.equal(requested, false);
});

test("Irys redirects permit only content-addressed legacy storage paths", () => {
  const id = "A".repeat(43);
  assert.equal(
    storageURL("https://gateway.irys.xyz/mutable/" + id),
    "https://gateway.irys.xyz/mutable/" + id,
  );
  assert.doesNotThrow(() =>
    storageURL(
      "https://" + "a".repeat(52) + "-data.legacy.datasprite-cdn.com/" + id,
    ),
  );
  for (const url of [
    "https://gateway.irys.xyz/admin",
    "https://evil.legacy.datasprite-cdn.com/" + id,
    "https://" + "a".repeat(52) + "-data.legacy.datasprite-cdn.com/private",
  ])
    assert.throws(() => storageURL(url));
});

test("IPFS metadata retries fixed same-CID gateways on failure without following remote redirects", async () => {
  const seen = [];
  const value = await readNFT(r, async (url, options) => {
    if (options.method === "POST") {
      const body = JSON.parse(options.body);
      return Response.json({
        result:
          body.method === "eth_blockNumber"
            ? "0x123"
            : encode("ipfs://bafytest/metadata.json"),
      });
    }
    seen.push(url);
    assert.equal(options.redirect, "manual");
    if (seen.length === 1) return new Response("rate limited", { status: 429 });
    if (seen.length === 2)
      return new Response("", {
        status: 302,
        headers: { location: "http://127.0.0.1/private" },
      });
    return Response.json({
      name: "Recovered",
      animation_url: "ipfs://bafytest/song.mp3",
    });
  });
  assert.equal(value.status, "live");
  assert.deepEqual(seen, [
    "https://ipfs.filebase.io/ipfs/bafytest/metadata.json",
    "https://gateway.pinata.cloud/ipfs/bafytest/metadata.json",
    "https://magic.decentralized-content.com/ipfs/bafytest/metadata.json",
  ]);
  assert.equal(value.mediaURI, "ipfs://bafytest/song.mp3");
});

import { readFileSync } from "node:fs";
test("Polygon Mint Songs onchain metadata keeps song attribution separate from the edition label", async () => {
  const fixture = JSON.parse(
    readFileSync(
      new URL("../data/mint-songs/polygon-discovery.json", import.meta.url),
    ),
  );
  const sample = fixture.samples.find((s) => s.tokenId === "60000");
  const calls = [];
  const value = await readNFT(
    {
      chainId: 137,
      contract: fixture.contract,
      standard: "ERC721",
      tokenId: "60000",
      kind: "audio",
    },
    async (url, options) => {
      assert.equal(url, "https://polygon-bor-rpc.publicnode.com");
      const body = JSON.parse(options.body);
      calls.push(body);
      return Response.json(
        body.method === "eth_blockNumber"
          ? { result: "0x" + fixture.referenceBlock.toString(16) }
          : sample.rpcResponse,
      );
    },
  );
  assert.equal(value.status, "live");
  assert.equal(value.title, "SHUT IT OFF");
  assert.equal(value.artist, "TAY");
  assert.equal(value.mediaURI, sample.metadata.animation_url);
  assert.equal(value.metadataURL, null);
  assert.equal(value.blockNumber, fixture.referenceBlock);
  assert.equal(
    calls[1].params[1],
    calls[0].method === "eth_blockNumber"
      ? "0x" + fixture.referenceBlock.toString(16)
      : "",
  );
  assert.ok(calls[1].params[0].data.startsWith("0xc87b56dd"));
});
test("malformed Polygon token JSON remains unresolved rather than guessed or discarded", async () => {
  const fixture = JSON.parse(
    readFileSync(
      new URL("../data/mint-songs/polygon-discovery.json", import.meta.url),
    ),
  );
  const sample = fixture.samples.find((s) => s.tokenId === "1000");
  const value = await readNFT(
    {
      chainId: 137,
      contract: fixture.contract,
      standard: "ERC721",
      tokenId: "1000",
    },
    async (url, options) => {
      const body = JSON.parse(options.body);
      return Response.json(
        body.method === "eth_blockNumber"
          ? { result: "0x123" }
          : sample.rpcResponse,
      );
    },
  );
  assert.equal(value.status, "unavailable");
  assert.equal(value.mediaURI, undefined);
});
