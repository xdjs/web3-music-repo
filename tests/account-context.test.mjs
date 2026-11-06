import test from "node:test";
import assert from "node:assert/strict";
import {
  isEmbeddedAccountContext,
  standaloneAccountURL,
} from "../src/account-context.mjs";

test("only a top-level browsing context may initialize the account SDK", () => {
  const self = {};
  assert.equal(isEmbeddedAccountContext({ self, top: self }), false);
  assert.equal(isEmbeddedAccountContext({ self, top: {} }), true);
  assert.equal(
    isEmbeddedAccountContext({
      self,
      get top() {
        throw Error("Cross-origin denied");
      },
    }),
    true,
  );
  assert.equal(isEmbeddedAccountContext(null), false);
});

test("standalone sign-in stays on this app's origin and drops arbitrary query/hash input", () => {
  assert.equal(
    standaloneAccountURL(
      "https://web3-music-repo.vercel.app/?return=https://evil.invalid/#record/abc",
    ),
    "https://web3-music-repo.vercel.app/#me",
  );
  assert.equal(
    standaloneAccountURL("http://127.0.0.1:4191/#artist/pete-rango"),
    "http://127.0.0.1:4191/#me",
  );
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,test",
    "https://user:secret@evil.invalid/",
    "//evil.invalid/",
  ])
    assert.equal(
      standaloneAccountURL(value),
      "https://web3-music-repo.vercel.app/#me",
    );
});
