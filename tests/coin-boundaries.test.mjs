import test from "node:test";
import assert from "node:assert/strict";
import { readCollectors } from "../src/recovery-collectors.mjs";
import { readWalletPage } from "../src/wallet-library.mjs";
const contract = "0x" + "b".repeat(40);
test("content coins cannot invoke NFT collectors even with a matching registry entry", async () => {
  const fail = () => {
    throw Error("NFT adapter called for content coin");
  };
  const result = await readCollectors(
    { standard: "ERC20", chainId: 8453, contract, tokenId: null },
    null,
    new Map([["8453:" + contract, {}]]),
    { readHolders: fail, readOwner: fail, readLegacyCollectors: fail },
  );
  assert.equal(result.status, "unsupported");
  assert.equal(result.scope, "coin");
});
test("NFT wallet matches cannot classify a content coin as a recovered edition", async () => {
  const result = await readWalletPage(
    "0x" + "a".repeat(40),
    8453,
    null,
    [{ id: "coin", chainId: 8453, contract, tokenId: null, standard: "ERC20" }],
    new Map([["8453:" + contract, {}]]),
    async () =>
      Response.json({
        items: [{ id: "1", token: { address_hash: contract }, value: "1" }],
        next_page_params: null,
      }),
  );
  assert.equal(result.items[0].recordId, null);
});
