import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readAnalysisCheckpoint } from "../src/bpm-analysis-checkpoint.mjs";
test("only a genuinely absent checkpoint may initialize empty analysis", () => {
  const dir = mkdtempSync(join(tmpdir(), "bpm-checkpoint-"));
  try {
    assert.deepEqual(readAnalysisCheckpoint(join(dir, "missing.json")), {
      records: {},
    });
    const path = join(dir, "saved.json");
    writeFileSync(
      path,
      JSON.stringify({ records: { song: { status: "estimated", bpm: 120 } } }),
    );
    assert.equal(readAnalysisCheckpoint(path).records.song.bpm, 120);
    assert.throws(() => readAnalysisCheckpoint(dir));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("malformed and wrong-shape checkpoints fail closed without changing existing bytes", () => {
  const dir = mkdtempSync(join(tmpdir(), "bpm-checkpoint-")),
    path = join(dir, "saved.json");
  try {
    for (const content of [
      "{broken",
      "{}",
      "null",
      '{"records":[]}',
      '{"records":null}',
    ]) {
      writeFileSync(path, content);
      assert.throws(() => readAnalysisCheckpoint(path));
      assert.equal(readFileSync(path, "utf8"), content);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
