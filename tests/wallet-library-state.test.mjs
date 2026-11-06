import test from "node:test";
import assert from "node:assert/strict";
import { createWalletLibraryState } from "../src/wallet-library-state.mjs";
const a = "0x" + "a".repeat(40),
  b = "0x" + "b".repeat(40),
  publicWallet = "0x" + "c".repeat(40);
const tick = () => new Promise((resolve) => setImmediate(resolve));
const account = (id, addresses) => ({
  ready: true,
  authenticated: !!id,
  accountId: id,
  addresses,
});
const page = (items = [], nextCursor = null) => ({
  status: "indexed",
  items,
  nextCursor,
  checkedAt: "2026-11-06T00:00:00Z",
});
test("linked EVM selection is automatic while explicit public queries survive late auth; logout clears only automatic selection", () => {
  const s = createWalletLibraryState({ fetchPage: async () => page() });
  s.setAccount(account("one", ["solana", a.toUpperCase()]));
  assert.equal(s.select("", true), a);
  assert.equal(s.snapshot().automatic, true);
  assert.equal(s.select(publicWallet, true), publicWallet);
  s.setAccount(account("two", [b]));
  assert.equal(s.select(publicWallet, true), publicWallet);
  assert.equal(s.snapshot().automatic, false);
  assert.equal(s.select("", true), b);
  s.setAccount(account(null, []));
  assert.equal(s.snapshot().address, "");
  assert.equal(s.select("", true), "");
  assert.equal(s.select(publicWallet, true), publicWallet);
});
test("automatic scan is bounded to five first pages and two concurrent requests; rerenders do not rescan and pagination remains explicit", async () => {
  const calls = [],
    releases = [];
  let inFlight = 0,
    max = 0;
  const s = createWalletLibraryState({
    fetchPage: async (address, chain, cursor) => {
      calls.push({ address, chain, cursor });
      inFlight++;
      max = Math.max(max, inFlight);
      await new Promise((resolve) => releases.push(resolve));
      inFlight--;
      return page(
        [{ contract: a, tokenId: "1", recordId: "song" }],
        chain === "1" && !cursor ? "page-two" : null,
      );
    },
  });
  s.select(a, true);
  s.start();
  s.start();
  await tick();
  assert.equal(calls.length, 2);
  for (let i = 0; i < 5; i++) {
    releases[i]();
    await tick();
  }
  assert.equal(calls.length, 5);
  assert.equal(max, 2);
  assert.ok(calls.every((c) => c.cursor === null));
  s.select(a, true);
  s.start();
  await tick();
  assert.equal(calls.length, 5);
  s.scan("1");
  await tick();
  assert.equal(calls[5].cursor, "page-two");
  releases[5]();
  await tick();
  assert.equal(s.snapshot().states.get("1").items.length, 1);
  assert.equal(s.snapshot().states.get("1").nextCursor, null);
});
test("network error stays distinct from a successful empty result and can be retried", async () => {
  let fail = true;
  const s = createWalletLibraryState({
    fetchPage: async () =>
      fail
        ? { status: "unavailable", message: "Provider unavailable" }
        : page(),
  });
  s.select(a);
  s.scan("8453");
  await tick();
  assert.equal(s.snapshot().states.get("8453").status, "error");
  assert.match(s.snapshot().states.get("8453").error, /Provider unavailable/);
  fail = false;
  s.scan("8453");
  await tick();
  assert.equal(s.snapshot().states.get("8453").status, "ready");
  assert.deepEqual(s.snapshot().states.get("8453").items, []);
});
test("late responses from a previous account are discarded and aborted requests cannot repaint its collection", async () => {
  const requests = [];
  const s = createWalletLibraryState({
    fetchPage: (address, chain, cursor, signal) =>
      new Promise((resolve) => requests.push({ address, signal, resolve })),
  });
  s.setAccount(account("one", [a]));
  s.select("", true);
  s.start();
  await tick();
  s.setAccount(account("two", [b]));
  s.select("", true);
  s.start();
  assert.ok(requests.every((r) => r.signal.aborted));
  for (const r of requests.slice())
    r.resolve(
      page([{ contract: a, tokenId: "1", recordId: "old-account-song" }]),
    );
  await tick();
  assert.equal(s.snapshot().address, b);
  assert.ok(
    [...s.snapshot().states.values()].every(
      (v) => !v?.items.some((i) => i.recordId === "old-account-song"),
    ),
  );
  s.setAccount(account(null, []));
  s.select("", true);
  for (const r of requests) r.resolve(page());
  await tick();
  assert.equal(s.snapshot().address, "");
  assert.ok([...s.snapshot().states.values()].every((v) => !v));
});
test("owned Explore scope unions linked indexed matches, excludes public lookups and drops unlinked accounts", async () => {
  const s = createWalletLibraryState({
    fetchPage: async (address) =>
      page([
        {
          contract: a,
          tokenId: "1",
          recordId:
            address === a
              ? "owned-a"
              : address === b
                ? "owned-b"
                : "public-only",
        },
      ]),
  });
  s.setAccount(account("one", [a, b]));
  s.select(publicWallet);
  s.start();
  await tick();
  assert.deepEqual([...s.ownedSnapshot().recordIds], []);
  s.startLinked();
  await tick();
  assert.deepEqual([...s.ownedSnapshot().recordIds].sort(), [
    "owned-a",
    "owned-b",
  ]);
  assert.equal(s.snapshot().address, publicWallet);
  s.setAccount(account("one", [b]));
  assert.deepEqual([...s.ownedSnapshot().recordIds], ["owned-b"]);
  s.setAccount(account(null, []));
  assert.equal(s.ownedSnapshot().recordIds.size, 0);
});
test("owned auto scan is capped at five wallets and first pages; incomplete/error coverage remains explicit", async () => {
  const addresses = Array.from(
    { length: 7 },
    (_, i) => "0x" + String(i + 1).repeat(40),
  );
  const calls = [];
  const s = createWalletLibraryState({
    fetchPage: async (address, chain, cursor) => {
      calls.push({ address, chain, cursor });
      return chain === "137"
        ? { status: "unavailable", message: "Unavailable" }
        : page([], chain === "1" ? "more" : null);
    },
  });
  s.setAccount(account("one", addresses));
  s.startLinked();
  await tick();
  s.startLinked();
  await tick();
  assert.equal(calls.length, 25);
  assert.ok(calls.every((c) => c.cursor === null));
  assert.equal(new Set(calls.map((c) => c.address)).size, 5);
  const snap = s.ownedSnapshot();
  assert.equal(snap.errors, 5);
  assert.equal(snap.unchecked, 10);
  assert.equal(snap.more, 5);
});
