import test from "node:test";
import assert from "node:assert/strict";
import {
  mintTransferTopic,
  zeroTopic,
  purchaseTopics,
  decodeLegacyMint,
  decodeLegacyPurchase,
} from "./sound-legacy-events.mjs";
const contract = "0x" + "a".repeat(40),
  token = (4n << 128n) + 1n,
  word = (n) => "0x" + BigInt(n).toString(16).padStart(64, "0");
test("mint history includes only transfer-from-zero, preserving full uint256 token IDs", () => {
  const e = {
    address: contract,
    topics: [mintTransferTopic, zeroTopic, word(9), word(token)],
    blockNumber: "0x100",
  };
  assert.equal(decodeLegacyMint(e, contract).tokenId, token.toString());
  assert.equal(
    decodeLegacyMint(
      { ...e, topics: [mintTransferTopic, word(9), zeroTopic, word(token)] },
      contract,
    ),
    null,
  );
  assert.equal(
    decodeLegacyMint({ ...e, address: "0x" + "b".repeat(40) }, contract),
    null,
  );
});
test("release grouping follows either historical purchase signature and requires a matching mint", () => {
  for (const topic of purchaseTopics) {
    const e = {
      address: contract,
      topics: [topic, word(4), word(token), word(9)],
      blockNumber: "0x100",
    };
    assert.equal(
      decodeLegacyPurchase(e, contract, new Set([token.toString()])).editionId,
      "4",
    );
    assert.equal(decodeLegacyPurchase(e, contract, new Set()), null);
  }
});
