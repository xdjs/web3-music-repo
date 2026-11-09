import { acquireRecoveryLock } from "../src/recovery-job-lock.mjs";
import { writeFileSync, renameSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createCatalogLoader } from "../src/catalog-bundle.mjs";
import { analyzeBpmMedia } from "../src/bpm-audio-analysis.mjs";
import { musicFacts } from "../src/music-facts.mjs";
import { createProviderCompletionCircuit } from "../src/bpm-campaign.mjs";
import { readAnalysisCheckpoint } from "../src/bpm-analysis-checkpoint.mjs";
const exec = promisify(execFile),
  load = createCatalogLoader(),
  initial = load();
const file = "data/audio-analysis.json";
const releaseLock = acquireRecoveryLock(file);
const state = readAnalysisCheckpoint(file),
  work = "work/bpm-audio";
mkdirSync(work, { recursive: true });
const localBinary = resolve("../.music-recovery-tools/cargo/bin/open-bpm");
const bin =
  process.env.OPEN_BPM_BIN ||
  (existsSync(localBinary) ? localBinary : "open-bpm");
const version = (await exec(bin, ["--version"])).stdout.trim();
state.engine = {
  name: "Open BPM",
  version,
  source: "https://github.com/fabriziosalmi/open-bpm",
  commit:
    process.env.OPEN_BPM_COMMIT ||
    (!process.env.OPEN_BPM_BIN && existsSync(localBinary)
      ? "73a3e6ef33f5c9d4131d118b14dcd4da73ec1775"
      : null),
  method:
    "Full available media decoded to mono 22050 Hz WAV; default segmented analysis, 60–200 BPM; estimates may be half or double tempo",
};
const max = Number(
  process.argv.find((a) => a.startsWith("--limit="))?.slice(8) || Infinity,
);
const retry = process.argv.includes("--retry");
const retryDeferred = process.argv.includes("--retry-deferred");
const platform = process.argv
  .find((a) => a.startsWith("--platform="))
  ?.slice(11);
const downloadTimeout = Number(
  process.argv.find((a) => a.startsWith("--download-timeout-ms="))?.slice(22) ||
    90000,
);
if (
  !Number.isInteger(downloadTimeout) ||
  downloadTimeout < 5000 ||
  downloadTimeout > 90000
)
  throw Error("Download timeout must be 5000–90000 ms");
const totalTransferTimeout = Number(
  process.argv
    .find((a) => a.startsWith("--total-transfer-timeout-ms="))
    ?.split("=")[1] || 180000,
);
if (
  !Number.isInteger(totalTransferTimeout) ||
  totalTransferTimeout < downloadTimeout ||
  totalTransferTimeout > 600000
)
  throw Error(
    "Total transfer timeout must be at least the connection timeout and at most 600000 ms",
  );
const jobs = initial.records
  .filter(
    (r) =>
      r.kind !== "artwork" &&
      (!platform || r.platform === platform) &&
      !musicFacts({ ...r, audioAnalysis: null }).bpm &&
      ((retry && state.records[r.id]?.status === "unavailable") ||
        (retryDeferred && state.records[r.id]?.status === "deferred") ||
        !state.records[r.id] ||
        state.records[r.id].status === "pending"),
  )
  .slice(0, max);
const concurrency = Number(
  process.argv.find((a) => a.startsWith("--concurrency="))?.slice(14) || 2,
);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4)
  throw Error("Concurrency must be an integer from 1 to 4");
const completionCircuit = createProviderCompletionCircuit();
let stopping = false;
process.once("SIGTERM", () => {
  stopping = true;
  state.stopRequestedAt = new Date().toISOString();
});
process.once("SIGINT", () => {
  stopping = true;
  state.stopRequestedAt = new Date().toISOString();
});
state.startedAt = new Date().toISOString();
state.concurrency = concurrency;
state.lastPass = {
  platform: platform || "all",
  limit: Number.isFinite(max) ? max : null,
  downloadTimeout,
  totalTransferTimeout,
  timeoutScope:
    "downloadTimeout applies separately to headers and no-progress; totalTransferTimeout bounds all gateway attempts",
  selectedRecords: jobs.map((r) => r.id),
};
state.interruptedAt = null;
state.stopRequestedAt = null;
state.finishedAt = null;
function save() {
  state.updatedAt = new Date().toISOString();
  state.counts = Object.values(state.records).reduce(
    (a, v) => ((a[v.status] = (a[v.status] || 0) + 1), a),
    {},
  );
  writeFileSync(file + ".tmp", JSON.stringify(state, null, 2));
  renameSync(file + ".tmp", file);
}
for (const r of jobs)
  if (!state.records[r.id]) state.records[r.id] = { status: "pending" };
save();
let cooldownUntil = 0;
const mediaResults = new Map();
let next = 0,
  done = 0;
async function analyze(r, source) {
  await new Promise((resolve) =>
    setTimeout(resolve, Math.max(0, cooldownUntil - Date.now())),
  );
  return analyzeBpmMedia(source, {
    binary: bin,
    workDirectory: work,
    downloadOptions: {
      connectionTimeoutMs: downloadTimeout,
      idleTimeoutMs: downloadTimeout,
      totalTimeoutMs: totalTransferTimeout,
      onRateLimit: () => {
        cooldownUntil = Math.max(cooldownUntil, Date.now() + 30000);
      },
    },
  });
}
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (!stopping && next < jobs.length) {
      const original = jobs[next++],
        r = load().records.find((x) => x.id === original.id) || original;
      const explicit = musicFacts({ ...r, audioAnalysis: null }).bpm;
      if (explicit) {
        state.records[r.id] = { status: "metadata-bpm", bpm: explicit };
        save();
        continue;
      }
      const evidence = load().evidence[r.id],
        source = evidence?.mediaURI || evidence?.mediaURL;
      if (!source) {
        state.records[r.id] = { status: "missing-media-reference" };
        save();
        continue;
      }
      try {
        if (!mediaResults.has(source))
          mediaResults.set(source, analyze(r, source));
        state.records[r.id] = { ...(await mediaResults.get(source)) };
      } catch (e) {
        state.records[r.id] = {
          status: e.deferred ? "deferred" : "unavailable",
          error: e.message,
          failureReason: e.reason || "analysis-error",
          retryable: Boolean(e.retryable),
          ...(e.attempts ? { attempts: e.attempts } : {}),
          ...(e.transfer ? { transfer: e.transfer } : {}),
          source,
          checkedAt: new Date().toISOString(),
        };
        mediaResults.delete(source);
      }
      const circuit = completionCircuit.complete(state.records[r.id]);
      state.lastPass.providerCircuit = circuit;
      if (circuit.stop) {
        stopping = true;
        state.lastPass.stopReason = "provider-failures";
      }
      save();
      console.log(
        "BPM",
        ++done,
        "/",
        jobs.length,
        r.id,
        state.records[r.id].status,
        state.records[r.id].bpm || "",
      );
    }
  }),
);
state.finishedAt = stopping ? null : new Date().toISOString();
state.interruptedAt = stopping ? new Date().toISOString() : null;
save();
releaseLock();
console.log(stopping ? "BPM CHECKPOINTED" : "BPM COMPLETE", state.counts);
