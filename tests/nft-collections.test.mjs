import test from "node:test";
import assert from "node:assert/strict";
import { readCollection } from "../src/nft-collections.mjs";
test("collection index preserves uint256 cursors and strips unneeded metadata", async () => {
  const result = await readCollection(
    { chainId: 1, contract: "0x" + "a".repeat(40) },
    null,
    async () =>
      new Response(
        '{"items":[{"id":"1361129467683753853853498429727072845879","metadata":{"name":"Song","description":"do not expose"}}],"next_page_params":{"unique_token":1361129467683753853853498429727072845830}}',
      ),
  );
  assert.equal(result.nextCursor, "1361129467683753853853498429727072845830");
  assert.equal(result.items[0].title, "Song");
  assert.equal(result.items[0].description, undefined);
});
