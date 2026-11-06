import test from "node:test";
import assert from "node:assert/strict";
import { resolveWalletName } from "../src/wallet-name.mjs";
const address = "0x" + "a".repeat(40);

test("ENS lookup normalizes names before the onchain forward lookup", async () => {
  let received;
  const result = await resolveWalletName("  RAFFY.eth  ", {
    getEnsAddress: async ({ name }) => {
      received = name;
      return address;
    },
  });
  assert.equal(received, "raffy.eth");
  assert.equal(result.status, "resolved");
  assert.equal(result.address, address);
  assert.equal(result.source, "https://app.ens.domains/raffy.eth");
  assert.ok(result.checkedAt);
});

test("ENS lookup rejects URLs, invalid labels and oversized input without a request", async () => {
  let calls = 0;
  for (const input of [
    null,
    "",
    "hello",
    "https://name.eth",
    "a..eth",
    "a b.eth",
    "x".repeat(256) + ".eth",
    "<script>.eth",
  ])
    assert.equal(
      (
        await resolveWalletName(input, {
          getEnsAddress: async () => {
            calls++;
            return address;
          },
        })
      ).status,
      "invalid",
    );
  assert.equal(calls, 0);
});

test("Unicode ENS names use ENS normalization rather than stripping characters", async () => {
  const result = await resolveWalletName("é.eth", {
    getEnsAddress: async ({ name }) => {
      assert.equal(name, "é.eth");
      return address;
    },
  });
  assert.equal(result.status, "resolved");
  assert.match(result.source, /%C3%A9\.eth$/);
});

test("an unassigned name is distinct from a failed or malformed RPC response", async () => {
  for (const value of [null, "0x" + "0".repeat(40)])
    assert.equal(
      (
        await resolveWalletName("empty.eth", {
          getEnsAddress: async () => value,
        })
      ).status,
      "not-found",
    );
  assert.equal(
    (
      await resolveWalletName("retry.eth", {
        getEnsAddress: async () => {
          throw Error("RPC timeout with diagnostics");
        },
      })
    ).status,
    "unavailable",
  );
  const malformed = await resolveWalletName("retry.eth", {
    getEnsAddress: async () => "https://invalid.example/",
  });
  assert.equal(malformed.status, "unavailable");
  assert.equal(malformed.address, undefined);
});
