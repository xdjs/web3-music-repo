import test from "node:test";
import assert from "node:assert/strict";
import { createDurableAccountPlaylistStore } from "../src/account-durable-store.mjs";
const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
const lists = [{ id: "one", name: "Music", recordIds: ["song"] }];
const path = (id, ns = "production") => `account-playlists-v1/${ns}/${id}.json`;
function backend() {
  const objects = new Map(),
    calls = [];
  let serial = 0;
  const metadata = (pathname, object) => ({
    pathname,
    etag: object.etag,
    size: Buffer.byteLength(object.body),
    url: `https://test.private.blob.vercel-storage.com/${pathname}`,
  });
  const sdk = {
    async get(key, options) {
      calls.push({ method: "get", key, options });
      assert.equal(options.access, "private");
      assert.equal(options.useCache, false);
      const object = objects.get(key);
      if (!object) return null;
      return {
        statusCode: 200,
        blob: metadata(key, object),
        stream: new Blob([object.body]).stream(),
      };
    },
    async put(key, body, options) {
      calls.push({ method: "put", key, options });
      assert.equal(options.access, "private");
      assert.equal(options.addRandomSuffix, false);
      const prior = objects.get(key);
      // This is an atomic server precondition, shared by independent adapters.
      if (
        (!options.allowOverwrite && prior) ||
        (options.ifMatch && options.ifMatch !== prior?.etag)
      )
        throw Error("Precondition failed");
      if (options.allowOverwrite)
        assert.ok(options.ifMatch, "overwrite must carry an ETag");
      const next = { body, etag: `"${++serial}"` };
      objects.set(key, next);
      return metadata(key, next);
    },
  };
  return { sdk, calls, objects };
}
const make = (server, options = {}) =>
  createDurableAccountPlaylistStore({ sdk: server.sdk, ...options });

test("private durable store persists across independent instances and isolates accounts/environments", async () => {
  const server = backend();
  const first = make(server),
    second = make(server);
  assert.deepEqual(await first.read(a), { revision: 0, playlists: [] });
  const saved = await first.write(a, 0, lists);
  assert.deepEqual(await second.read(a), saved);
  assert.deepEqual(await second.read(b), { revision: 0, playlists: [] });
  assert.deepEqual(await make(server, { namespace: "preview" }).read(a), {
    revision: 0,
    playlists: [],
  });
  assert.equal(saved.revision, 1);
  assert.equal("accountId" in saved, false);
  assert.equal("url" in saved, false);
});

test("two independent first writers cannot both create or overwrite one another", async () => {
  const server = backend();
  const result = await Promise.all([
    make(server).write(a, 0, lists),
    make(server).write(a, 0, []),
  ]);
  assert.equal(result.filter((r) => r.conflict).length, 1);
  assert.equal(result.filter((r) => !r.conflict).length, 1);
  assert.deepEqual(
    (await make(server).read(a)).playlists,
    result.find((r) => !r.conflict).playlists,
  );
  assert.ok(
    server.calls
      .filter((c) => c.method === "put")
      .every((c) => c.options.allowOverwrite === false),
  );
});

test("concurrent updates use atomic ETag CAS and stale revisions never write", async () => {
  const server = backend();
  await make(server).write(a, 0, lists);
  const result = await Promise.all([
    make(server).write(a, 1, []),
    make(server).write(a, 1, [{ ...lists[0], name: "Second" }]),
  ]);
  assert.equal(result.filter((r) => r.conflict).length, 1);
  assert.equal((await make(server).read(a)).revision, 2);
  const before = server.calls.filter((c) => c.method === "put").length;
  assert.equal((await make(server).write(a, 1, lists)).conflict, true);
  assert.equal(server.calls.filter((c) => c.method === "put").length, before);
  assert.ok(
    server.calls
      .filter((c) => c.method === "put" && c.options.allowOverwrite)
      .every((c) => c.options.ifMatch),
  );
});

test("path traversal, forged identities, malformed revisions and input are rejected", async () => {
  const server = backend(),
    store = make(server);
  for (const id of [
    "../" + a,
    a + "/x",
    "https://evil.test/a",
    "------------------------------------",
  ])
    await assert.rejects(() => store.read(id), /Invalid account/);
  for (const revision of [-1, 1.1, "0", Number.MAX_SAFE_INTEGER, NaN])
    await assert.rejects(
      () => store.write(a, revision, lists),
      /Invalid playlists/,
    );
  for (const value of [
    null,
    [null],
    [{ ...lists[0], id: "" }],
    [lists[0], lists[0]],
    [{ ...lists[0], createdAt: { owner: b } }],
  ])
    await assert.rejects(() => store.write(a, 0, value), /Invalid playlists/);
  assert.throws(() => make(server, { namespace: "../../production" }));
  const result = await store.write(a, 0, [
    { ...lists[0], accountId: b, public: true, revision: 99 },
  ]);
  assert.deepEqual(result.playlists, lists);
  assert.equal(server.objects.has(path(b)), false);
});

test("corrupted or cross-account stored data fails closed rather than appearing empty", async () => {
  const server = backend();
  await make(server).write(a, 0, lists);
  const original = structuredClone(server.objects.get(path(a)));
  for (const body of [
    "{bad",
    JSON.stringify({ ...JSON.parse(original.body), accountId: b }),
    JSON.stringify({ ...JSON.parse(original.body), revision: -1 }),
    JSON.stringify({ ...JSON.parse(original.body), playlists: [null] }),
  ]) {
    server.objects.set(path(a), { ...original, body });
    await assert.rejects(() => make(server).read(a));
    await assert.rejects(() => make(server).write(a, 0, []));
  }
});

test("provider errors never turn into empty reads or successful saves", async () => {
  const server = backend();
  server.sdk.get = async () => {
    throw Error("provider unavailable");
  };
  await assert.rejects(() => make(server).read(a), /provider unavailable/);
  await assert.rejects(
    () => make(server).write(a, 0, lists),
    /provider unavailable/,
  );
  const other = backend();
  other.sdk.put = async () => {
    throw Error("quota");
  };
  await assert.rejects(() => make(other).write(a, 0, lists), /quota/);
  assert.equal(other.objects.size, 0);
});

test("timed-out acknowledgment after committed write returns a conflict, never blindly retries", async () => {
  const server = backend(),
    realPut = server.sdk.put;
  server.sdk.put = async (...args) => {
    await realPut(...args);
    throw Error("timeout");
  };
  const result = await make(server).write(a, 0, lists);
  assert.equal(result.conflict, true);
  assert.equal(result.revision, 1);
  assert.deepEqual(result.playlists, lists);
  assert.equal(server.calls.filter((c) => c.method === "put").length, 1);
});

test("public or mismatched blob responses and oversized libraries fail closed", async () => {
  const server = backend();
  await make(server).write(a, 0, lists);
  const realGet = server.sdk.get;
  for (const patch of [
    { url: `https://test.public.blob.vercel-storage.com/${path(a)}` },
    { pathname: path(b) },
    { etag: "" },
    { size: 600000 },
  ]) {
    server.sdk.get = async (...args) => {
      const r = await realGet(...args);
      Object.assign(r.blob, patch);
      return r;
    };
    await assert.rejects(() => make(server).read(a));
  }
  server.sdk.get = realGet;
  await assert.rejects(
    () =>
      make(server).write(a, 1, [
        {
          id: "large",
          name: "Large",
          recordIds: Array.from({ length: 5000 }, () => "s".repeat(200)),
        },
      ]),
    /Invalid playlists/,
  );
});

test("SDK and credentials load only on server operation and private reads bypass CDN", async () => {
  const server = backend();
  let loaded = 0;
  const store = createDurableAccountPlaylistStore({
    loadSdk: async () => {
      loaded++;
      return server.sdk;
    },
    storeId: "store_test",
  });
  assert.equal(loaded, 0);
  await store.write(a, 0, lists);
  await store.read(a);
  assert.equal(loaded, 1);
  for (const call of server.calls) {
    assert.equal(call.options.storeId, "store_test");
    assert.equal(call.options.access, "private");
    assert.equal("token" in call.options, false);
  }
});
