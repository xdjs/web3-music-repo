import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizePlaylist,
  recoverySummary,
  sourceKind,
} from "../src/recovery-model.mjs";
import { readOwner } from "../src/recovery-owner.mjs";
test("archived playlist retains all 23 IDs and makes the missing eight explicit", () => {
  const d = JSON.parse(
    readFileSync(
      new URL("../evidence/sound-wayback/playlist-data.json", import.meta.url),
    ),
  );
  const p = normalizePlaylist(d);
  assert.equal(p.tracks.length, 23);
  assert.equal(p.tracks.filter((t) => t.missing).length, 8);
  assert.deepEqual(
    p.tracks.map((t) => t.id),
    d.props.pageProps.shelf.trackIds,
  );
  assert.equal(p.curator, "Juan Latorre");
});
test("metadata recovery totals never count unavailable or unattempted records as recovered", () => {
  const r = [
    { id: "a", chainId: 1, platform: "Sound" },
    { id: "b", chainId: 10 },
    { id: "c", chainId: 1 },
  ];
  const s = recoverySummary(r, {
    a: { status: "live" },
    b: { status: "unavailable" },
  });
  assert.equal(s.readable, 1);
  assert.equal(s.unavailable, 1);
  assert.equal(s.notAttempted, 1);
  assert.equal(sourceKind("ar://abc"), "Arweave");
  assert.equal(sourceKind("data:application/json;base64,e30="), "Onchain JSON");
});
test("ownerOf uses the same explicit block and preserves uint256 token IDs", async () => {
  const calls = [];
  const address = "0x" + "1".repeat(40);
  const v = await readOwner(
    {
      chainId: 1,
      contract: "0x" + "a".repeat(40),
      tokenId: "340282366920938463463374607431768211481",
    },
    async (_, o) => {
      const b = JSON.parse(o.body);
      calls.push(b);
      return Response.json({
        result:
          b.method === "eth_blockNumber"
            ? "0x123"
            : "0x" + "0".repeat(24) + address.slice(2),
      });
    },
  );
  assert.equal(v.address, address);
  assert.equal(v.blockNumber, 291);
  assert.equal(calls[1].params[1], "0x123");
  assert.equal(calls[1].params[0].data.length, 74);
});
test("owner lookup failure is not an empty successful collector list", async () => {
  const v = await readOwner({ chainId: 1, tokenId: "1" }, async () =>
    Response.json({ error: { message: "unavailable" } }),
  );
  assert.equal(v.status, "unavailable");
  assert.equal(v.address, undefined);
});
import { createPlaylistStore } from "../src/personal-playlists.mjs";
import { readHolders } from "../src/recovery-holders.mjs";
test("playlist order and edits survive reload; rejected saves preserve previous state", () => {
  const data = new Map();
  let fail = false;
  const storage = {
    getItem: (k) => data.get(k),
    setItem: (k, v) => {
      if (fail) throw Error("quota");
      data.set(k, v);
    },
  };
  const s = createPlaylistStore(storage);
  const id = s.create("  Evening  ", "a");
  s.update(id, (p) => ({ ...p, recordIds: [...p.recordIds, "b"] }));
  s.update(id, (p) => ({ ...p, recordIds: p.recordIds.reverse() }));
  assert.deepEqual(createPlaylistStore(storage).all()[0].recordIds, ["b", "a"]);
  fail = true;
  assert.throws(() => s.remove(id));
  assert.equal(s.all()[0].name, "Evening");
  assert.equal(s.all().length, 1);
});
test("holder failures and untrusted cursor keys remain unavailable", async () => {
  let called = false;
  const f = async () => {
    called = true;
    return Response.json({ items: [] });
  };
  const cursor = Buffer.from(
    JSON.stringify({ url: "https://example.org" }),
  ).toString("base64url");
  const r = await readHolders(
    { chainId: 1, contract: "0x" + "a".repeat(40) },
    cursor,
    f,
  );
  assert.equal(r.status, "unavailable");
  assert.equal(called, false);
});
import {
  releaseRegistry,
  readCollectors,
} from "../src/recovery-collectors.mjs";
import {
  resolveWalletIdentity,
  createProfileReader,
} from "../src/collector-profiles.mjs";
test("release collector scope requires an exact known factory; artist contracts never become release holders", async () => {
  const contract = "0x" + "a".repeat(40),
    transaction = "0x" + "b".repeat(64);
  const registry = releaseRegistry([
    {
      version: 1,
      chainId: 1,
      factory: "0xaef3e8c8723d9c31863be8de54df2668ef7c4b89",
      collections: [{ contract, transaction }],
    },
    {
      version: 0,
      chainId: 1,
      factory: "0x78e3adc0e811e4f93bd9f1f9389b923c9a3355c2",
      collections: [{ contract: "0x" + "c".repeat(40), transaction }],
    },
  ]);
  assert.equal(registry.size, 1);
  let holders = false;
  const adapters = {
    readHolders: async () => {
      holders = true;
      return { status: "indexed", items: [] };
    },
    readOwner: async () => ({
      status: "verified",
      address: "0x" + "d".repeat(40),
      tokenId: "1",
    }),
  };
  assert.equal(
    (
      await readCollectors(
        { chainId: 1, contract, tokenId: "1" },
        null,
        registry,
        adapters,
      )
    ).scope,
    "release",
  );
  assert.equal(holders, true);
  holders = false;
  const result = await readCollectors(
    { chainId: 1, contract: "0x" + "c".repeat(40), tokenId: "1" },
    null,
    registry,
    adapters,
  );
  assert.equal(result.scope, "token");
  assert.equal(holders, false);
  assert.equal(result.items.length, 1);
});
test("ENS name is rejected when its forward address differs from the wallet", async () => {
  let avatarRead = false;
  const v = await resolveWalletIdentity("0x" + "a".repeat(40), {
    getEnsName: async () => "claimed.eth",
    getEnsAddress: async () => "0x" + "b".repeat(40),
    getEnsText: async () => {
      avatarRead = true;
      return "https://example.org/a.png";
    },
  });
  assert.equal(v.status, "not-configured");
  assert.equal(v.name, undefined);
  assert.equal(avatarRead, false);
});
test("temporary ENS failure retains historical profile and its source", async () => {
  const address = "0x" + "a".repeat(40);
  const read = createProfileReader(
    [
      {
        address,
        name: "Archived name",
        avatarURL: "https://example.org/a.png",
        localAvatar: "/collectors/a.img",
        capturedAt: "2023-05-01",
      },
    ],
    async () => ({ status: "unavailable" }),
  );
  const p = await read(address);
  assert.equal(p.name, "Archived name");
  assert.equal(p.avatarURL, "/collectors/a.img");
  assert.equal(p.ens.status, "unavailable");
  assert.match(p.avatarSource, /2023-05-01/);
});
