import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  verifiedMintComment,
  commentsForRecord,
} from "../src/zora-comments.mjs";

const log = JSON.parse(
  readFileSync(new URL("../data/zora-rpc-comment-probe.json", import.meta.url)),
).logs[0];
const receipt = JSON.parse(
  readFileSync(
    new URL(
      `../evidence/zora-comments/${log.transactionHash}.json`,
      import.meta.url,
    ),
  ),
);
const options = {
  chainId: 7777777,
  emitter: "0x04e2516a2c207e84a1839755675dfd8ef6302f0a",
  endBlock: log.blockNumber,
};

test("real Zora comment requires an official emitter and the same successful mint receipt", () => {
  const comment = verifiedMintComment(log, receipt, options);
  assert.equal(comment.message, "happy friday ");
  assert.equal(comment.tokenId, "1");
  assert.equal(comment.recipient, "0x589ffbbda0eacd5a9c2ba208b379c886b2630503");
  assert.equal(
    verifiedMintComment({ ...log, removed: true }, receipt, options),
    null,
  );
  assert.equal(
    verifiedMintComment(log, { ...receipt, status: "0x0" }, options),
    null,
  );
  assert.equal(
    verifiedMintComment(log, { ...receipt, blockHash: "0xdead" }, options),
    null,
  );
  assert.equal(
    verifiedMintComment(log, receipt, {
      ...options,
      emitter: "0x0000000000000000000000000000000000000001",
    }),
    null,
  );
  assert.equal(
    verifiedMintComment(log, receipt, { ...options, endBlock: "0x1" }),
    null,
  );
});

test("an event alone or altered event cannot become a verified mint comment", () => {
  assert.equal(
    verifiedMintComment(log, { ...receipt, logs: [log] }, options),
    null,
  );
  assert.equal(
    verifiedMintComment({ ...log, data: log.data + "00" }, receipt, options),
    null,
  );
  const otherTokenMint = {
    ...receipt,
    logs: receipt.logs.filter(
      (item) =>
        item.address.toLowerCase() !==
        "0x91dccffe742653fb533f8b5aca94ef2aa58e25b4",
    ),
  };
  assert.equal(verifiedMintComment(log, otherTokenMint, options), null);
});

test("comments never cross chain, contract, token or verification boundaries", () => {
  const comment = verifiedMintComment(log, receipt, options);
  const record = {
    chainId: comment.chainId,
    contract: comment.contract.toUpperCase(),
    tokenId: comment.tokenId,
  };
  assert.deepEqual(commentsForRecord(record, [comment]), [comment]);
  for (const changed of [
    { chainId: 8453 },
    { tokenId: "2" },
    { contract: "0x0000000000000000000000000000000000000001" },
  ]) {
    assert.deepEqual(
      commentsForRecord({ ...record, ...changed }, [comment]),
      [],
    );
  }
  assert.deepEqual(
    commentsForRecord(record, [{ ...comment, verification: "candidate" }]),
    [],
  );
});
