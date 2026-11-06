import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readLegacyCollectors,
  parseTokenPage,
} from "../src/legacy-collectors.mjs";
const contract = "0x" + "1".repeat(40),
  address = "0x" + "2".repeat(40);
const record = {
  chainId: 1,
  contract,
  factoryVersion: 0,
  factory: "0x78e3adc0e811e4f93bd9f1f9389b923c9a3355c2",
  legacyEditionId: 1,
};
test("legacy token cursor preserves full uint256 instead of rounding JSON numbers", () => {
  const n = (2n << 128n) + 17n;
  assert.equal(
    parseTokenPage(`{"next_page_params":{"unique_token":${n}}}`)
      .next_page_params.unique_token,
    n.toString(),
  );
});
test("legacy collectors exclude other song editions in shared artist contracts", async () => {
  const id = (1n << 128n) + 1n,
    other = (2n << 128n) + 1n;
  const fetcher = async () =>
    new Response(
      JSON.stringify({
        items: [
          { id: id.toString(), owner: { hash: address } },
          { id: other.toString(), owner: { hash: "0x" + "3".repeat(40) } },
        ],
        next_page_params: null,
      }),
    );
  const d = await readLegacyCollectors(record, null, fetcher);
  assert.equal(d.status, "indexed");
  assert.deepEqual(d.items, [
    { address, balance: "1", tokenIds: [id.toString()] },
  ]);
});
test("unverified legacy factory and malicious cursor never reach the network", async () => {
  let calls = 0;
  const fetcher = () => {
    calls++;
    throw Error();
  };
  assert.equal(
    (
      await readLegacyCollectors(
        { ...record, factory: "0x" + "9".repeat(40) },
        null,
        fetcher,
      )
    ).status,
    "unavailable",
  );
  const cursor = Buffer.from(
    JSON.stringify({ url: "https://example.com" }),
  ).toString("base64url");
  assert.equal(
    (await readLegacyCollectors(record, cursor, fetcher)).status,
    "unavailable",
  );
  assert.equal(calls, 0);
});
test("old sequential IDs require onchain mapping at a single explicit block", async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    if (!options?.method)
      return new Response(
        JSON.stringify({
          items: [
            { id: "26", owner: { hash: address } },
            { id: "27", owner: { hash: address } },
          ],
          next_page_params: null,
        }),
      );
    const q = JSON.parse(options.body);
    calls.push(q);
    if (!Array.isArray(q)) return Response.json({ result: "0x100" });
    return Response.json([
      { id: 1, result: "0x2" },
      { id: 0, result: "0x1" },
    ]);
  };
  const d = await readLegacyCollectors(record, null, fetcher);
  assert.equal(d.status, "indexed");
  assert.deepEqual(d.items[0].tokenIds, ["26"]);
  assert.equal(calls[1][0].params[1], "0x100");
  assert.equal(calls[1][1].params[1], "0x100");
});
