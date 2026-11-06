import test from "node:test";
import assert from "node:assert/strict";
import {
  isSolanaMint,
  isSolanaAsset,
  solanaMintIdentity,
  assetIdentityKey,
  assetCollectionKey,
} from "../src/solana-identity.mjs";
const mint = "122gW5E6uqWKEsb1KdCjVhWtarbCTdN7hR1bjt9dgdaw";
test("Solana keys must decode to exactly32bytes and preserve case", () => {
  assert.equal(isSolanaMint(mint), true);
  assert.equal(isSolanaMint(mint.replace("W", "w")), true);
  for (const bad of [
    "0x" + "a".repeat(40),
    "1".repeat(31),
    "1".repeat(33),
    "z".repeat(44),
    mint + " ",
    mint + "0",
    "not-a-mint",
  ])
    assert.equal(isSolanaMint(bad), false);
  assert.notEqual(
    assetIdentityKey({ chainId: "solana", mint }),
    assetIdentityKey({ chainId: "solana", mint: mint.replace("W", "w") }),
  );
  assert.equal(assetIdentityKey({ chainId: "solana", mint }), `solana:${mint}`);
});
test("Metaplex indexed mint does not become an EVM contract or token zero", () => {
  const n = {
    chainId: "solana",
    contractAddress: mint,
    id: mint,
    tokenId: null,
    nftFactoryByNftFactoryId: { standard: "metaplex" },
  };
  assert.deepEqual(solanaMintIdentity(n), {
    chainId: "solana",
    mint,
    standard: "METAPLEX",
  });
  for (const change of [
    { id: "other" },
    { tokenId: "0" },
    { chainId: "ethereum" },
    { nftFactoryByNftFactoryId: { standard: "erc721" } },
  ])
    assert.equal(solanaMintIdentity({ ...n, ...change }), null);
  assert.equal(isSolanaAsset({ chainId: "solana" }), true);
  assert.equal(isSolanaAsset({ chainId: 1 }), false);
});
test("asset keys retain EVM normalization and distinguish content coins", () => {
  const r = { chainId: 8453, contract: "0x" + "A".repeat(40), tokenId: "0001" };
  assert.equal(assetIdentityKey(r), `8453:0x${"a".repeat(40)}:1`);
  assert.equal(assetCollectionKey(r), `8453:0x${"a".repeat(40)}`);
  assert.equal(
    assetIdentityKey({ ...r, standard: "ERC20", tokenId: null }),
    `8453:0x${"a".repeat(40)}:coin`,
  );
  assert.equal(assetIdentityKey({ ...r, tokenId: 9007199254740992 }), null);
  assert.equal(assetIdentityKey({ ...r, chainId: "unknown" }), null);
});
