import {
  openSync,
  writeFileSync,
  closeSync,
  readFileSync,
  unlinkSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
// Single-writer protection for resumable recovery JSON. A stale lock is never
// automatically deleted: inspect its PID/cwd before removing it and resuming.
export function acquireRecoveryLock(output) {
  const path = output + ".lock",
    nonce = randomUUID();
  let fd;
  try {
    fd = openSync(path, "wx", 0o600);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    let owner;
    try {
      owner = JSON.parse(readFileSync(path, "utf8"));
    } catch {}
    throw Error(
      `Recovery output is locked: ${output}${owner?.pid ? ` (PID ${owner.pid})` : ""}. Check the worker before removing ${path}.`,
    );
  }
  try {
    writeFileSync(
      fd,
      JSON.stringify({
        pid: process.pid,
        cwd: process.cwd(),
        startedAt: new Date().toISOString(),
        nonce,
      }),
    );
  } finally {
    closeSync(fd);
  }
  const release = () => {
    try {
      if (JSON.parse(readFileSync(path, "utf8")).nonce === nonce)
        unlinkSync(path);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  };
  process.once("exit", release);
  return () => {
    process.removeListener("exit", release);
    release();
  };
}
