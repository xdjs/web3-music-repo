import test from "node:test";
import assert from "node:assert/strict";
import {
  accountRequest,
  linkedWallets,
  loginErrorMessage,
} from "../src/account-client.mjs";

test("account requests wait for a newly authenticated token before contacting the account API", async () => {
  const tokens = [null, null, "valid-token"],
    delays = [];
  const result = await accountRequest(
    "/api/account",
    {},
    async () => tokens.shift(),
    async (path, options) => {
      assert.equal(path, "/api/account");
      assert.equal(options.headers.Authorization, "Bearer valid-token");
      return Response.json({ name: "Listener" });
    },
    async (delay) => delays.push(delay),
  );
  assert.deepEqual(delays, [300, 600]);
  assert.equal(result.name, "Listener");
});
test("missing tokens and cancelled sessions never send unauthenticated requests", async () => {
  let calls = 0;
  await assert.rejects(
    accountRequest(
      "/api/account",
      {},
      async () => null,
      async () => {
        calls++;
      },
      async () => {},
    ),
    /session is still loading/,
  );
  const signal = AbortSignal.abort();
  await assert.rejects(
    accountRequest(
      "/api/account",
      { signal },
      async () => "token",
      async () => {
        calls++;
      },
    ),
  );
  assert.equal(calls, 0);
});
test("account onboarding and playlist conflicts retain distinguishable errors", async () => {
  await assert.rejects(
    accountRequest(
      "/api/account",
      {},
      async () => "token",
      async () =>
        Response.json(
          { error: "Finish Music Nerd setup", needsMusicNerdAccount: true },
          { status: 409 },
        ),
    ),
    (e) => e.status === 409 && e.needsMusicNerdAccount === true,
  );
  await assert.rejects(
    accountRequest(
      "/api/account/playlists",
      {},
      async () => "token",
      async () => Response.json({ conflict: true }, { status: 409 }),
    ),
    /Load the latest library/,
  );
});
test("wallets deduplicate EVM addresses but preserve case-sensitive Solana identities", () => {
  const wallets = linkedWallets([
    { type: "wallet", chainType: "ethereum", address: "0xAbC" },
    { type: "wallet", chainType: "ethereum", address: "0xabc" },
    { type: "wallet", chainType: "solana", address: "ABC" },
    { type: "wallet", chainType: "solana", address: "abc" },
    { type: "email", address: "not-wallet" },
  ]);
  assert.equal(wallets.length, 3);
});
test("origin and cancelled login errors give actionable recovery without leaking raw diagnostics", () => {
  assert.match(
    loginErrorMessage({ code: "invalid_origin" }),
    /not enabled for this address/,
  );
  assert.match(loginErrorMessage("user_cancelled"), /cancelled/);
  assert.equal(
    loginErrorMessage({ message: "private internal diagnostic" }),
    "Sign-in could not be completed. Please try again.",
  );
});
