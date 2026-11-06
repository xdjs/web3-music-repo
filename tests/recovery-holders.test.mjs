import test from "node:test";
import assert from "node:assert/strict";
import {
  readTokenHolders,
  readMediaHolders,
  holderMediaKey,
} from "../src/recovery-holders.mjs";
import { readCollectors } from "../src/recovery-collectors.mjs";
const contract = "0x" + "1".repeat(40),
  address = "0x" + "2".repeat(40),
  other = "0x" + "3".repeat(40),
  cid = "QmOriginalAudio";
const record = { chainId: 1, contract, tokenId: "3", standard: "ERC1155" };
test("ERC1155 holders use token-specific endpoint and retain uint256 balances/pagination", async () => {
  let url;
  const value = (1n << 200n).toString();
  const result = await readTokenHolders(record, null, async (u) => {
    url = String(u);
    return new Response(
      `{"items":[{"address":{"hash":"${address}"},"value":${value},"token_id":3}],"next_page_params":{"address_hash":"${address}","value":${value},"items_count":50}}`,
    );
  });
  assert.match(url, /\/instances\/3\/holders$/);
  assert.equal(result.scope, "token-edition");
  assert.equal(result.items[0].balance, value);
  assert.equal(result.items[0].tokenId, "3");
  let second;
  await readTokenHolders(record, result.nextCursor, async (u) => {
    second = String(u);
    return Response.json({ items: [], next_page_params: null });
  });
  assert.match(second, new RegExp("value=" + value));
});
test("token holders reject cross-token rows, malformed balances and hostile cursors without false empty success", async () => {
  for (const row of [
    { address: { hash: address }, value: "1", token_id: "4" },
    { address: { hash: address }, value: "NaN" },
  ])
    assert.equal(
      (
        await readTokenHolders(record, null, async () =>
          Response.json({ items: [row] }),
        )
      ).status,
      "unavailable",
    );
  let calls = 0;
  const bad = Buffer.from(
    JSON.stringify({ url: "https://evil.test" }),
  ).toString("base64url");
  assert.equal(
    (
      await readTokenHolders(record, bad, async () => {
        calls++;
      })
    ).status,
    "unavailable",
  );
  assert.equal(calls, 0);
});
test("ERC721 sibling collectors require the same immutable media, not shared artwork/title/contract", async () => {
  const r = {
    ...record,
    standard: "ERC721",
    collectorMediaURI: "ipfs://" + cid,
  };
  const result = await readMediaHolders(r, null, async () =>
    Response.json({
      items: [
        {
          id: "1",
          owner: { hash: address },
          metadata: { animation_url: "https://ipfs.io/ipfs/" + cid },
        },
        {
          id: "2",
          owner: { hash: address },
          metadata: { animation_url: "ipfs://" + cid },
        },
        {
          id: "3",
          owner: { hash: other },
          metadata: {
            animation_url: "ipfs://different",
            image: "ipfs://" + cid,
          },
        },
        { id: "4", owner: { hash: other }, metadata: { name: "same title" } },
      ],
      next_page_params: null,
    }),
  );
  assert.equal(result.status, "indexed");
  assert.equal(result.scope, "media-release");
  assert.deepEqual(
    result.items.map((x) => [x.address, x.balance, x.tokenIds]),
    [[address, "2", ["1", "2"]]],
  );
  assert.equal(result.unmatchedTokenCount, 2);
  assert.equal(holderMediaKey("https://example.com/song.mp3"), null);
  assert.equal(holderMediaKey("ipfs://CID/../song.mp3"), null);
});
test("ERC1155 collector routing never falls back to ownerOf or contract-wide holders", async () => {
  let tokenCalls = 0;
  const fail = () => {
    throw Error("wrong adapter");
  };
  const result = await readCollectors(
    record,
    null,
    new Map([[`1:${contract}`, { factory: "sound" }]]),
    {
      readHolders: fail,
      readOwner: fail,
      readTokenHolders: async () => {
        tokenCalls++;
        return { status: "indexed", scope: "token-edition", items: [] };
      },
    },
  );
  assert.equal(result.scope, "token-edition");
  assert.equal(tokenCalls, 1);
});
test("media-matched failure can fall back to selected ERC721 owner; later-page failure remains retryable", async () => {
  const r = {
    ...record,
    standard: "ERC721",
    collectorMediaURI: "ipfs://" + cid,
  };
  let ownerCalls = 0;
  const adapters = {
    readMediaHolders: async () => ({ status: "unavailable" }),
    readOwner: async () => {
      ownerCalls++;
      return { status: "verified", address };
    },
  };
  assert.equal(
    (await readCollectors(r, null, new Map(), adapters)).scope,
    "token",
  );
  assert.equal(
    (await readCollectors(r, "cursor", new Map(), adapters)).status,
    "unavailable",
  );
  assert.equal(ownerCalls, 1);
});
test("unavailable network/index remains distinct from successful empty holder page", async () => {
  assert.equal(
    (
      await readTokenHolders({ ...record, chainId: 137 }, null, async () => {
        throw Error();
      })
    ).status,
    "unavailable",
  );
  assert.equal(
    (
      await readTokenHolders(record, null, async () =>
        Response.json({ items: [], next_page_params: null }),
      )
    ).status,
    "indexed",
  );
  assert.equal(
    (
      await readTokenHolders(
        record,
        null,
        async () => new Response("quota", { status: 429 }),
      )
    ).status,
    "unavailable",
  );
});

test("an empty media index does not hide a directly readable selected-token owner", async () => {
  const result = await readCollectors(
    { ...record, standard: "ERC721", collectorMediaURI: "ipfs://" + cid },
    null,
    new Map(),
    {
      readMediaHolders: async () => ({
        status: "indexed",
        items: [],
        nextCursor: null,
      }),
      readOwner: async () => ({ status: "verified", address }),
    },
  );
  assert.equal(result.scope, "token");
  assert.equal(result.items[0].address, address);
});
