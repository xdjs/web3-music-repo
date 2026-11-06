// Bounded synthetic-account probe for a newly provisioned private store.
// No real accounts or Music Nerd database writes. Deletes only its random paths.
import { readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import * as blob from "@vercel/blob";
import { createDurableAccountPlaylistStore } from "../src/account-durable-store.mjs";
const envPath = process.argv
  .find((s) => s.startsWith("--env-file="))
  ?.slice(11);
if (envPath) {
  const loaded = parseEnv(readFileSync(envPath, "utf8"));
  for (const key of [
    "BLOB_STORE_ID",
    "BLOB_READ_WRITE_TOKEN",
    "VERCEL_OIDC_TOKEN",
  ])
    if (loaded[key]) process.env[key] = loaded[key];
}
if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN)
  throw Error("Private store credentials unavailable");
const namespace = `verification-${Date.now()}`;
const a = randomUUID(),
  b = randomUUID();
const options = {
  storeId: process.env.BLOB_STORE_ID,
  ...(process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN
    ? {}
    : { token: process.env.BLOB_READ_WRITE_TOKEN }),
};
const create = () =>
  createDurableAccountPlaylistStore({
    ...options,
    namespace,
    timeoutMs: 20000,
  });
const checks = [];
const path = (id) => `account-playlists-v1/${namespace}/${id}.json`;
const report = {
  checkedAt: new Date().toISOString(),
  syntheticAccountsOnly: true,
  namespace,
  checks,
  cleanedUp: false,
};
try {
  const first = create(),
    second = create();
  const lists = [
    {
      id: "synthetic",
      name: "Storage verification",
      recordIds: ["synthetic-record"],
    },
  ];
  assert.deepEqual(await first.read(a), { revision: 0, playlists: [] });
  checks.push("missing-is-empty");
  const initial = await Promise.all([
    first.write(a, 0, lists),
    second.write(a, 0, []),
  ]);
  assert.equal(initial.filter((r) => r.conflict).length, 1);
  checks.push("concurrent-create-one-winner");
  assert.equal((await create().read(a)).revision, 1);
  checks.push("cross-instance-persistence");
  const updates = await Promise.all([
    first.write(a, 1, lists),
    second.write(a, 1, []),
  ]);
  assert.equal(updates.filter((r) => r.conflict).length, 1);
  checks.push("concurrent-update-etag-cas");
  assert.equal((await create().read(a)).revision, 2);
  assert.equal((await create().write(a, 0, lists)).conflict, true);
  checks.push("stale-revision-conflict");
  assert.deepEqual(await create().read(b), { revision: 0, playlists: [] });
  checks.push("account-isolation");
  const stored = await blob.get(path(a), {
    ...options,
    access: "private",
    useCache: false,
  });
  await stored.stream?.cancel();
  const anonymous = await fetch(stored.blob.url, {
    method: "GET",
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
  await anonymous.body?.cancel();
  assert.ok(
    [401, 403, 404].includes(anonymous.status),
    `Anonymous read unexpectedly returned ${anonymous.status}`,
  );
  checks.push("anonymous-read-denied");
  report.anonymousStatus = anonymous.status;
} catch (error) {
  report.error = error.name + ": " + (error.message || "Probe failed");
  process.exitCode = 1;
} finally {
  try {
    for (const id of [a, b]) {
      const current = await blob.get(path(id), {
        ...options,
        access: "private",
        useCache: false,
      });
      if (current) {
        await current.stream?.cancel();
        await blob.del(path(id), { ...options, ifMatch: current.blob.etag });
      }
      const remaining = await blob.get(path(id), {
        ...options,
        access: "private",
        useCache: false,
      });
      if (remaining) {
        await remaining.stream?.cancel();
        throw Error("Synthetic cleanup read-back failed");
      }
    }
    report.cleanedUp = true;
  } catch {
    report.cleanupError =
      "Probe cleanup incomplete; use exact synthetic namespace from report";
    process.exitCode = 1;
  }
  writeFileSync(
    "data/account-durable-store-live.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  // No credential, private URL, body or canonical account details in output.
  console.log(JSON.stringify(report, null, 2));
}
