import {
  readFileSync,
  writeFileSync,
  openSync,
  closeSync,
  renameSync,
  unlinkSync,
} from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import {
  applyCandidateResponse,
  candidateRelationQuery,
  candidateNftIds,
  needsRelationRetry,
} from "./spinamp-resolve-nfts.mjs";
const path = "data/spinamp/nft-references.json.gz",
  lockPath = path + ".lock",
  endpoint = "https://api.spinamp.xyz/v3/graphql";
const max = Number(process.env.SPINAMP_RETRY_LIMIT || 169);
if (!Number.isInteger(max) || max < 1 || max > 169)
  throw Error("Bound must be 1..169");
const lock = openSync(lockPath, "wx");
writeFileSync(lock, String(process.pid));
closeSync(lock);
const report = {
  startedAt: new Date().toISOString(),
  endpoint,
  maxTracks: max,
  maximumRequests: max * 2,
  requests: 0,
  queryScope:
    "Exact processed-track AND candidate-NFT relation lookup; candidate IDs never accepted without confirmed relation, total editions unknown",
  attempts: [],
};
let stop = false;
const halt = () => {
  stop = true;
};
process.on("SIGINT", halt);
process.on("SIGTERM", halt);
async function read(query) {
  report.requests++;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Error("HTTP " + response.status);
  const body = await response.json();
  await new Promise((r) => setTimeout(r, 500));
  return body;
}
try {
  const state = JSON.parse(gunzipSync(readFileSync(path))),
    inventory = JSON.parse(
      gunzipSync(readFileSync("data/spinamp/inventory.json.gz")),
    ).records;
  const pending = () =>
    inventory.filter((r) => needsRelationRetry(state, r.id)).length;
  report.pendingBefore = pending();
  const selected = inventory
    .filter((r) => needsRelationRetry(state, r.id))
    .slice(0, max);
  let consecutiveFailures = 0;
  for (const r of selected) {
    if (stop) {
      report.stopReason = "Graceful stop requested";
      break;
    }
    const start = Date.now();
    try {
      let success = false,
        providerError = false;
      const candidates = candidateNftIds(r.id);
      if (!candidates.length)
        state.failures[r.id] =
          "No bounded candidate identity available; requires broader relation lookup";
      for (const nftId of candidates) {
        const result = await read(candidateRelationQuery(r.id, nftId));
        success = applyCandidateResponse(state, r.id, nftId, result);
        providerError = Boolean(result.errors?.length);
        if (success || providerError) break;
      }
      consecutiveFailures = providerError ? consecutiveFailures + 1 : 0;
      report.attempts.push({
        id: r.id,
        platform: r.platformId,
        status: success
          ? state.references[r.id]
            ? "resolved"
            : "empty"
          : "unresolved",
        error: state.failures?.[r.id] || null,
        ms: Date.now() - start,
      });
    } catch (error) {
      state.failures[r.id] = error.message;
      consecutiveFailures++;
      report.attempts.push({
        id: r.id,
        platform: r.platformId,
        status: "unresolved",
        error: error.message,
        ms: Date.now() - start,
      });
    }
    state.updatedAt = new Date().toISOString();
    state.pendingCount = pending();
    state.resolvedCount = inventory.filter((r) =>
      Object.hasOwn(state.references, r.id),
    ).length;
    state.complete = state.pendingCount === 0;
    writeFileSync(path + ".tmp", gzipSync(JSON.stringify(state)));
    renameSync(path + ".tmp", path);
    report.pendingAfter = state.pendingCount;
    writeFileSync(
      "data/spinamp/representative-retry-2026-11-06.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      JSON.stringify({
        attempt: report.attempts.length,
        pending: state.pendingCount,
        ...report.attempts.at(-1),
      }),
    );
    if (consecutiveFailures >= 3) {
      report.stopReason = "Three consecutive provider/validation failures";
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  report.pendingAfter = pending();
  report.resolvedThisRun = report.attempts.filter(
    (a) => a.status === "resolved",
  ).length;
  report.emptyThisRun = report.attempts.filter(
    (a) => a.status === "empty",
  ).length;
  report.stopReason ||= "Bounded selected cohort completed";
} finally {
  report.finishedAt = new Date().toISOString();
  writeFileSync(
    "data/spinamp/representative-retry-2026-11-06.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  unlinkSync(lockPath);
  process.off("SIGINT", halt);
  process.off("SIGTERM", halt);
  console.log(
    JSON.stringify({
      pendingBefore: report.pendingBefore,
      pendingAfter: report.pendingAfter,
      resolved: report.resolvedThisRun,
      attempts: report.attempts.length,
      stopReason: report.stopReason,
    }),
  );
}
