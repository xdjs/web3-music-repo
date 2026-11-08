import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import {
  TRACK_METADATA_QUERY,
  TRACK_METADATA_SOURCE,
  validateTrackMetadataPage,
  trackMetadataCounts,
} from "../src/spinamp-track-metadata.mjs";
const directory = "data/spinamp/processed-track-metadata",
  hash = (v) => createHash("sha256").update(v).digest("hex"),
  read = (p) => JSON.parse(readFileSync(p));
test("all frozen identities have ordered complete portable raw pages with exact hashes and source bindings", () => {
  const checkpoint = read(directory + "/checkpoint.json"),
    snapshotBytes = readFileSync(directory + "/identity-snapshot.json.gz"),
    frozen = JSON.parse(gunzipSync(snapshotBytes)),
    snapshot = new Map(frozen.records.map((r) => [r.id, r])),
    seen = new Set(),
    rows = [];
  assert.equal(hash(snapshotBytes), checkpoint.snapshotSha256);
  assert.equal(checkpoint.pages.length, 106);
  let after = null;
  for (const page of checkpoint.pages) {
    const raw = gunzipSync(readFileSync(directory + "/" + page.file));
    assert.equal(hash(raw), page.sha256);
    const receipt = JSON.parse(raw);
    assert.equal(receipt.source, TRACK_METADATA_SOURCE);
    assert.equal(receipt.query, TRACK_METADATA_QUERY);
    assert.equal(receipt.variables.after, after);
    assert.equal(receipt.variables.first, 500);
    assert.equal(receipt.httpStatus, 200);
    const result = validateTrackMetadataPage(receipt.body, {
      after,
      first: 500,
      snapshot,
      seen,
    });
    assert.equal(result.page.nodes.length, page.count);
    assert.equal(result.page.totalCount, 52987);
    assert.equal(
      result.rows.every((r) => r.status === "matched"),
      true,
    );
    for (const r of result.page.nodes) {
      seen.add(r.id);
      rows.push(r);
    }
    after = result.page.pageInfo.endCursor;
    assert.equal(
      result.page.pageInfo.hasNextPage,
      page !== checkpoint.pages.at(-1),
    );
  }
  assert.equal(seen.size, 52987);
  assert.equal(checkpoint.rows, seen.size);
  assert.equal(checkpoint.frozenMatched, seen.size);
  assert.equal(checkpoint.after, after);
  assert.deepEqual(checkpoint.frozenMissing, []);
  assert.equal(checkpoint.complete, true);
  const summary = read(directory + "/summary.json");
  assert.deepEqual(summary.counts, trackMetadataCounts(rows));
  assert.equal(summary.completeFrozenCoverage, true);
});
