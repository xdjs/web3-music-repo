import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, exportSPKI, SignJWT } from "jose";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { verifyAccountToken } from "../src/verify-account-token.mjs";
import { createAccountPlaylistStore } from "../src/account-playlist-store.mjs";
test("account identity accepts only valid unexpired tokens for the configured Music Nerd app", async () => {
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const config = {
    appId: "musicnerd",
    verificationKey: await exportSPKI(publicKey),
  };
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256" })
    .setSubject("did:privy:test")
    .setAudience("musicnerd")
    .setIssuer("privy.io")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);
  assert.equal(await verifyAccountToken(token, config), "did:privy:test");
  await assert.rejects(() =>
    verifyAccountToken(token, { ...config, appId: "other" }),
  );
  await assert.rejects(() =>
    verifyAccountToken("privyid:did:privy:test", config),
  );
  const expired = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256" })
    .setSubject("did:privy:test")
    .setAudience("musicnerd")
    .setIssuer("privy.io")
    .setIssuedAt(1)
    .setExpirationTime(2)
    .sign(privateKey);
  await assert.rejects(() => verifyAccountToken(expired, config));
});
test("account playlist persistence isolates users and rejects stale concurrent overwrites", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "recovery-accounts-"));
  try {
    const store = createAccountPlaylistStore(root),
      a = "11111111-1111-4111-8111-111111111111",
      b = "22222222-2222-4222-8222-222222222222";
    const lists = [{ id: "one", name: "Music", recordIds: ["song"] }];
    const results = await Promise.all([
      store.write(a, 0, lists),
      store.write(a, 0, []),
    ]);
    assert.equal(results.filter((r) => r.conflict).length, 1);
    assert.deepEqual((await store.read(a)).playlists, lists);
    assert.deepEqual((await store.read(b)).playlists, []);
    assert.deepEqual(
      (await createAccountPlaylistStore(root).read(a)).playlists,
      lists,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
