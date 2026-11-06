import test from "node:test";
import assert from "node:assert/strict";
import { createReadCache } from "../src/request-cache.mjs";
test("concurrent reads share work, unavailable reads retry, and successful reads expire", async () => {
  let time = 0,
    calls = 0;
  const read = createReadCache({ ttl: 10, now: () => time });
  const load = async () => {
    calls++;
    return { status: "live", value: calls };
  };
  const [a, b] = await Promise.all([read("song", load), read("song", load)]);
  assert.equal(calls, 1);
  assert.equal(a, b);
  await read("song", load);
  assert.equal(calls, 1);
  time = 11;
  await read("song", load);
  assert.equal(calls, 2);
  const fail = async () => {
    calls++;
    return { status: "unavailable" };
  };
  await read("other", fail);
  await read("other", fail);
  assert.equal(calls, 4);
});
test("rejected reads are retryable and cache size is bounded", async () => {
  const read = createReadCache({ limit: 1 });
  await assert.rejects(
    read("a", () => {
      throw Error("offline");
    }),
  );
  await read("a", async () => ({ status: "live" }));
  await read("b", async () => ({ status: "live" }));
  let called = false;
  await read("a", async () => {
    called = true;
    return { status: "live" };
  });
  assert.ok(called);
});
