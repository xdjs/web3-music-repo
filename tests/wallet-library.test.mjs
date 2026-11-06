import test from "node:test";
import assert from "node:assert/strict";
import { readWalletPage } from "../src/wallet-library.mjs";
const wallet = "0x" + "a".repeat(40),
  contract = "0x" + "b".repeat(40);
test("wallet matching requires exact token or verified release; preserves uint256 IDs", async () => {
  const huge = (2n ** 200n).toString();
  const records = [{ id: "song", chainId: 1, contract, tokenId: "1" }];
  const f = async () =>
    Response.json({
      items: [{ id: huge, token: { address_hash: contract }, value: "1" }],
      next_page_params: null,
    });
  const a = await readWalletPage(wallet, 1, null, records, new Map(), f);
  assert.equal(a.items[0].recordId, null);
  assert.equal(a.items[0].tokenId, huge);
  const b = await readWalletPage(
    wallet,
    1,
    null,
    records,
    new Map([["1:" + contract, {}]]),
    f,
  );
  assert.equal(b.items[0].recordId, "song");
});
test("indexer failure and hostile cursor cannot become an empty successful collection", async () => {
  let called = false;
  const f = async () => {
    called = true;
    return new Response("", { status: 503 });
  };
  const a = await readWalletPage(
    wallet,
    1,
    Buffer.from(JSON.stringify({ url: "https://evil.test" })).toString(
      "base64url",
    ),
    [],
    new Map(),
    f,
  );
  assert.equal(a.status, "unavailable");
  assert.equal(called, false);
  assert.equal(
    (await readWalletPage(wallet, 1, null, [], new Map(), f)).status,
    "unavailable",
  );
});

test("verified sampled edition IDs match a recovered song without assuming unsampled editions", async () => {
  const records = [
    {
      id: "song",
      chainId: 137,
      contract,
      tokenId: "1",
      observedTokenIds: ["1", "9"],
    },
  ];
  const result = await readWalletPage(
    wallet,
    137,
    null,
    records,
    new Map(),
    async () =>
      Response.json({
        items: ["9", "10"].map((id) => ({
          id,
          token: { address_hash: contract },
          value: "1",
        })),
        next_page_params: null,
      }),
  );
  assert.equal(result.items[0].recordId, "song");
  assert.equal(result.items[1].recordId, null);
});
