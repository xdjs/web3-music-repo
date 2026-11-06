import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acquireRecoveryLock } from "../src/recovery-job-lock.mjs";
test("a second writer cannot overwrite a recovery output and normal release permits resume", () => {
  const dir = mkdtempSync(join(tmpdir(), "recovery-lock-")),
    output = join(dir, "data.json");
  try {
    const release = acquireRecoveryLock(output);
    assert.throws(() => acquireRecoveryLock(output), /locked/);
    release();
    acquireRecoveryLock(output)();
    assert.equal(existsSync(output + ".lock"), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("release never deletes a lock owned by another worker", () => {
  const dir = mkdtempSync(join(tmpdir(), "recovery-lock-")),
    output = join(dir, "data.json");
  try {
    const release = acquireRecoveryLock(output);
    writeFileSync(output + ".lock", JSON.stringify({ nonce: "replacement" }));
    release();
    assert.equal(existsSync(output + ".lock"), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
