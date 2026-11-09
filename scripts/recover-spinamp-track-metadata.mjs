import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  renameSync,
} from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { acquireRecoveryLock } from "../src/recovery-job-lock.mjs";
import {
  TRACK_METADATA_SOURCE,
  TRACK_METADATA_QUERY,
  TRACK_SNAPSHOT_FIELDS,
  validateTrackMetadataPage,
  trackMetadataCounts,
} from "../src/spinamp-track-metadata.mjs";
const directory = "data/spinamp/processed-track-metadata",
  snapshotPath = directory + "/identity-snapshot.json.gz",
  checkpointPath = directory + "/checkpoint.json";
mkdirSync(directory, { recursive: true });
const hash = (value) => createHash("sha256").update(value).digest("hex");
const unzip = (path) => JSON.parse(gunzipSync(readFileSync(path)));
const release = acquireRecoveryLock(checkpointPath);
let stop = false;
for (const signal of ["SIGTERM", "SIGINT"])
  process.once(signal, () => {
    stop = true;
  });
try {
  if (!existsSync(snapshotPath)) {
    const inv = unzip("data/spinamp/inventory.json.gz");
    const snapshot = {
      source: inv.source,
      finishedAt: inv.finishedAt,
      inventoryCount: inv.records.length,
      inventorySha256: hash(readFileSync("data/spinamp/inventory.json.gz")),
      scope:
        "Exact source identity and media-reference fields from the frozen inventory; not an NFT ownership snapshot",
      records: inv.records.map((row) =>
        Object.fromEntries(
          TRACK_SNAPSHOT_FIELDS.map((key) => [key, row[key] ?? null]),
        ),
      ),
    };
    writeFileSync(snapshotPath, gzipSync(JSON.stringify(snapshot)), {
      flag: "wx",
    });
  }
  const frozen = unzip(snapshotPath),
    snapshot = new Map(frozen.records.map((row) => [row.id, row]));
  if (snapshot.size !== frozen.records.length || snapshot.size !== 52987)
    throw Error("Frozen identity snapshot count mismatch");
  const snapshotSha256 = hash(readFileSync(snapshotPath));
  const state = existsSync(checkpointPath)
    ? JSON.parse(readFileSync(checkpointPath))
    : {
        source: TRACK_METADATA_SOURCE,
        query: TRACK_METADATA_QUERY,
        snapshotSha256,
        startedAt: new Date().toISOString(),
        pages: [],
        after: null,
        complete: false,
        failures: [],
      };
  if (
    state.query !== TRACK_METADATA_QUERY ||
    state.snapshotSha256 !== snapshotSha256
  )
    throw Error("Checkpoint source query/snapshot changed");
  const all = [],
    seen = new Set();
  let expectedAfter = null;
  for (const entry of state.pages) {
    const bytes = gunzipSync(readFileSync(directory + "/" + entry.file));
    if (hash(bytes) !== entry.sha256) throw Error("Saved page hash mismatch");
    const receipt = JSON.parse(bytes);
    if (
      receipt.source !== TRACK_METADATA_SOURCE ||
      receipt.query !== TRACK_METADATA_QUERY ||
      receipt.variables?.after !== expectedAfter ||
      receipt.variables?.first !== 500
    )
      throw Error("Saved page cursor/source mismatch");
    const inspected = validateTrackMetadataPage(receipt.body, {
      after: receipt.variables.after,
      first: 500,
      snapshot,
      seen,
    });
    if (entry.count !== inspected.page.nodes.length)
      throw Error("Saved page count mismatch");
    expectedAfter = inspected.page.pageInfo.endCursor;
    for (const row of inspected.page.nodes) {
      seen.add(row.id);
      all.push(row);
    }
  }
  if (state.after !== expectedAfter)
    throw Error("Checkpoint cursor does not match saved pages");
  const save = () => {
    state.updatedAt = new Date().toISOString();
    state.pid = process.pid;
    state.rows = seen.size;
    state.frozenMatched = all.filter(
      (row) =>
        snapshot.has(row.id) &&
        TRACK_SNAPSHOT_FIELDS.every(
          (key) => (snapshot.get(row.id)[key] ?? null) === row[key],
        ),
    ).length;
    state.frozenMissing = [...snapshot.keys()].filter((id) => !seen.has(id));
    writeFileSync(checkpointPath + ".tmp", JSON.stringify(state, null, 2));
    renameSync(checkpointPath + ".tmp", checkpointPath);
  };
  let requests = 0,
    consecutiveFailures = 0,
    pagesThisCampaign = 0;
  while (
    !state.complete &&
    !stop &&
    pagesThisCampaign < 106 &&
    requests < 109
  ) {
    const variables = { after: state.after, first: 500 };
    const filename = String(state.pages.length).padStart(3, "0") + ".json.gz";
    const path = directory + "/" + filename;
    let receipt;
    try {
      if (existsSync(path)) {
        receipt = unzip(path);
        if (
          receipt.query !== TRACK_METADATA_QUERY ||
          receipt.variables.after !== state.after ||
          receipt.variables.first !== 500
        )
          throw Error("Uncommitted page identity mismatch");
      } else {
        requests++;
        const response = await fetch(TRACK_METADATA_SOURCE, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query: TRACK_METADATA_QUERY, variables }),
          signal: AbortSignal.timeout(30000),
        });
        if (!response.ok) throw Error("HTTP " + response.status);
        let size = 0;
        const chunks = [];
        for await (const part of response.body) {
          size += part.length;
          if (size > 8 * 1024 * 1024)
            throw Error("Provider page exceeds8MB budget");
          chunks.push(part);
        }
        receipt = {
          source: TRACK_METADATA_SOURCE,
          checkedAt: new Date().toISOString(),
          query: TRACK_METADATA_QUERY,
          variables,
          httpStatus: response.status,
          body: JSON.parse(Buffer.concat(chunks).toString()),
        };
      }
      const inspected = validateTrackMetadataPage(receipt.body, {
        ...variables,
        snapshot,
        seen,
      });
      const raw = JSON.stringify(receipt);
      if (!existsSync(path)) writeFileSync(path, gzipSync(raw), { flag: "wx" });
      state.pages.push({
        file: filename,
        sha256: hash(raw),
        count: inspected.page.nodes.length,
        totalCount: inspected.page.totalCount,
        checkedAt: receipt.checkedAt,
        matched: inspected.rows.filter((r) => r.status === "matched").length,
        quarantined: inspected.rows.filter((r) => r.status !== "matched"),
      });
      for (const row of inspected.page.nodes) {
        seen.add(row.id);
        all.push(row);
      }
      state.after = inspected.page.pageInfo.endCursor;
      state.complete = !inspected.page.pageInfo.hasNextPage;
      state.status = state.complete ? "pagination-complete" : "running";
      consecutiveFailures = 0;
      pagesThisCampaign++;
      save();
      console.log(
        JSON.stringify({
          pages: state.pages.length,
          rows: seen.size,
          matched: state.frozenMatched,
          remaining: state.frozenMissing.length,
        }),
      );
    } catch (error) {
      consecutiveFailures++;
      const failureFile = `failure-${Date.now()}-${requests}.json.gz`;
      const failedRaw = JSON.stringify({
        source: TRACK_METADATA_SOURCE,
        query: TRACK_METADATA_QUERY,
        variables,
        checkedAt: new Date().toISOString(),
        receipt: receipt || null,
        error: error.message,
      });
      writeFileSync(directory + "/" + failureFile, gzipSync(failedRaw), {
        flag: "wx",
      });
      state.failures.push({
        file: failureFile,
        sha256: hash(failedRaw),
        checkedAt: new Date().toISOString(),
        after: state.after,
        error: error.message,
        retryable: true,
      });
      state.status = "provider-or-validation-error";
      save();
      console.log(
        JSON.stringify({ error: error.message, consecutiveFailures, requests }),
      );
      if (consecutiveFailures >= 3) {
        state.status = "stopped-after-three-failures";
        break;
      }
      if (existsSync(path)) break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (stop) state.status = "interrupted";
  else if (!state.complete && !state.status.startsWith("stopped"))
    state.status = "bounded-campaign-ended";
  state.lastCampaign = {
    finishedAt: new Date().toISOString(),
    requests,
    pages: pagesThisCampaign,
  };
  save();
  const accepted = all.filter(
    (row) =>
      snapshot.has(row.id) &&
      TRACK_SNAPSHOT_FIELDS.every(
        (key) => (snapshot.get(row.id)[key] ?? null) === row[key],
      ),
  );
  const summary = {
    checkedAt: new Date().toISOString(),
    source: TRACK_METADATA_SOURCE,
    scope:
      "Verbatim public processed-track fields. No automatic metadata overlay, token identity, mint date, musical key, tempo, lyric or collaborator-role claims.",
    frozenRecords: snapshot.size,
    pages: state.pages.length,
    rows: seen.size,
    matched: accepted.length,
    missing: state.frozenMissing.length,
    quarantined: state.pages.flatMap((p) => p.quarantined),
    paginationComplete: state.complete,
    completeFrozenCoverage: state.complete && accepted.length === snapshot.size,
    counts: trackMetadataCounts(accepted),
    failures: state.failures,
    status: state.status,
  };
  writeFileSync(directory + "/summary.json", JSON.stringify(summary, null, 2));
  console.log(
    JSON.stringify({
      status: summary.status,
      completeFrozenCoverage: summary.completeFrozenCoverage,
      counts: summary.counts,
    }),
  );
} finally {
  release();
}
