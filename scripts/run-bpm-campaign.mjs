import {
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  openSync,
  closeSync,
} from "node:fs";
import { spawn } from "node:child_process";
import { createCatalogLoader } from "../src/catalog-bundle.mjs";
import { acquireRecoveryLock } from "../src/recovery-job-lock.mjs";
import {
  campaignPlan,
  campaignCounts,
  providerCircuit,
  campaignConcurrency,
} from "../src/bpm-campaign.mjs";
const concurrency = campaignConcurrency(process.argv.slice(2));
const statusPath = "data/bpm-campaign-status.json",
  analysisPath = "data/audio-analysis.json",
  loadCatalog = createCatalogLoader();
const read = (path, fallback) => {
  try {
    return JSON.parse(readFileSync(path));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
};
const release = acquireRecoveryLock(statusPath),
  prior = read(statusPath, {});
const status = {
  ...prior,
  pid: process.pid,
  startedAt: new Date().toISOString(),
  finishedAt: null,
  stopRequestedAt: null,
  reason: null,
  waitingFor: null,
  activeBatch: null,
  providerCircuit: { stop: false, sample: 0, failures: 0, rateLimited: 0 },
  state: "starting",
  batchSize: 50,
  concurrency,
  downloadTimeout: 20000,
  scope:
    "Supplied BPM preserved; new Open BPM estimates only; prior unavailable and needs-review records excluded. No keys inferred.",
  batches: prior.batches || [],
};
let stopping = false,
  child = null,
  childDone = null,
  childResult = null,
  childLog = null,
  lastPlatform = prior.lastPlatform || null,
  blocked = false,
  lastPrint = 0;
const requestStop = () => {
  stopping = true;
  status.stopRequestedAt = new Date().toISOString();
  if (child && !childDone) child.kill("SIGTERM");
};
process.once("SIGTERM", requestStop);
process.once("SIGINT", requestStop);
mkdirSync("work/bpm-campaign", { recursive: true });
const save = (analysis, records) => {
  status.updatedAt = new Date().toISOString();
  status.counts = campaignCounts(records, analysis);
  status.plan = campaignPlan(records, analysis, lastPlatform);
  // Public status retains counts/platforms; selected IDs are already checkpointed by analyzer.
  if (status.plan.next)
    status.plan.next = {
      platform: status.plan.next.platform,
      records: status.plan.next.recordIds.length,
    };
  writeFileSync(statusPath + ".tmp", JSON.stringify(status, null, 2));
  renameSync(statusPath + ".tmp", statusPath);
  if (Date.now() - lastPrint > 60000) {
    console.log(
      JSON.stringify({
        pid: process.pid,
        state: status.state,
        counts: status.counts,
        waitingFor: status.waitingFor,
        activeBatch: status.activeBatch,
      }),
    );
    lastPrint = Date.now();
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function inspectLock(lock) {
  if (
    !lock ||
    !Number.isInteger(lock.pid) ||
    lock.pid <= 1 ||
    lock.cwd !== process.cwd()
  )
    return "invalid";
  try {
    process.kill(lock.pid, 0);
    return "alive";
  } catch (e) {
    return e.code === "ESRCH"
      ? "stale"
      : e.code === "EPERM"
        ? "unknown-permission"
        : "unknown";
  }
}
function passResults(analysis) {
  return (analysis.lastPass?.selectedRecords || [])
    .map((id) => analysis.records?.[id])
    .filter((r) => r?.checkedAt && r.status !== "pending")
    .sort((a, b) => Date.parse(a.checkedAt) - Date.parse(b.checkedAt));
}
try {
  console.log("BPM CAMPAIGN PID", process.pid);
  while (!stopping) {
    const analysis = read(analysisPath, { records: {} }),
      records = loadCatalog().records,
      lock = read(analysisPath + ".lock", null);
    if (child) {
      const own = lock?.pid === child.pid;
      if (own) {
        const circuit = providerCircuit(passResults(analysis));
        status.providerCircuit = circuit;
        if (circuit.stop) {
          status.state = "stopping-provider-failures";
          status.reason =
            "Sustained provider failures; manual review/restart required";
          blocked = true;
          stopping = true;
          child.kill("SIGTERM");
          save(analysis, records);
          break;
        }
      }
      if (!childDone) {
        status.state = "analyzing";
        save(analysis, records);
        await sleep(5000);
        continue;
      }
      closeSync(childLog);
      childLog = null;
      status.batches.push({
        ...status.activeBatch,
        finishedAt: new Date().toISOString(),
        exitCode: childResult.code,
        signal: childResult.signal,
        results: passResults(analysis).reduce(
          (s, r) => ((s[r.status] = (s[r.status] || 0) + 1), s),
          {},
        ),
      });
      // A fast analyzer can trip its completion circuit and exit between polls.
      // Never silently continue to the next batch in that case.
      if (
        analysis.lastPass?.stopReason === "provider-failures" ||
        providerCircuit(passResults(analysis)).stop
      ) {
        status.state = "stopped-provider-failures";
        status.providerCircuit =
          analysis.lastPass?.providerCircuit ||
          providerCircuit(passResults(analysis));
        status.reason =
          "Sustained provider failures; manual review/restart required";
        blocked = true;
        stopping = true;
        save(analysis, records);
        break;
      }
      if (childResult.code !== 0) {
        status.state = "blocked-analyzer-exit";
        status.reason =
          "Analyzer exited unsuccessfully; inspect ignored work/bpm-campaign log before resuming";
        blocked = true;
        stopping = true;
        save(analysis, records);
        break;
      }
      lastPlatform = status.activeBatch.platform;
      status.lastPlatform = lastPlatform;
      status.activeBatch = null;
      child = null;
      childDone = null;
      childResult = null;
      save(analysis, records);
      await sleep(1500);
      continue;
    }
    if (lock) {
      const health = inspectLock(lock);
      status.waitingFor = {
        pid: lock.pid,
        cwd: lock.cwd,
        startedAt: lock.startedAt,
        health,
        analysisUpdatedAt: analysis.updatedAt || null,
      };
      if (["stale", "invalid"].includes(health)) {
        status.state = "blocked-analysis-lock";
        status.reason =
          "Existing analysis lock is stale or unrecognized; it was not removed";
        blocked = true;
        stopping = true;
        save(analysis, records);
        break;
      }
      const circuit = providerCircuit(passResults(analysis));
      status.providerCircuit = circuit;
      if (circuit.stop) {
        status.state = "blocked-existing-provider-failures";
        status.reason =
          "Existing worker has sustained provider failures; coordinator never signals workers it did not start";
        blocked = true;
        stopping = true;
        save(analysis, records);
        break;
      }
      const age = Date.now() - Date.parse(analysis.updatedAt || lock.startedAt);
      status.state =
        age > 10 * 60 * 1000
          ? "waiting-stalled-existing-writer"
          : "waiting-existing-writer";
      save(analysis, records);
      await sleep(15000);
      continue;
    }
    status.waitingFor = null;
    const plan = campaignPlan(records, analysis, lastPlatform);
    if (!plan.next) {
      status.state = "complete";
      status.finishedAt = new Date().toISOString();
      save(analysis, records);
      break;
    }
    const { platform, recordIds } = plan.next,
      stamp = new Date().toISOString();
    childLog = openSync(
      `work/bpm-campaign/${stamp.replace(/[:.]/g, "-")}.log`,
      "a",
    );
    const args = [
      "scripts/analyze-missing-bpm.mjs",
      `--platform=${platform}`,
      `--limit=${recordIds.length}`,
      `--concurrency=${concurrency}`,
      "--download-timeout-ms=20000",
    ];
    child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      stdio: ["ignore", childLog, childLog],
      env: { ...process.env, RAYON_NUM_THREADS: "2" },
    });
    childDone = false;
    childResult = null;
    const launched = child;
    child.on("error", (error) => {
      childResult = { code: 1, signal: null, error: error.message };
      childDone = true;
    });
    child.on("exit", (code, signal) => {
      if (launched === child) {
        childResult = { code, signal };
        childDone = true;
      }
    });
    status.state = "analyzing";
    status.activeBatch = {
      pid: child.pid,
      platform,
      startedAt: stamp,
      plannedRecords: recordIds.length,
    };
    console.log(JSON.stringify({ batchStarted: status.activeBatch }));
    save(analysis, records);
    await sleep(1000);
  }
  if (child && !childDone) {
    while (!childDone) await sleep(1000);
  }
  if (childLog !== null) {
    closeSync(childLog);
    childLog = null;
  }
  if (stopping && !blocked) status.state = "stopped";
  if (status.state !== "complete") status.finishedAt = null;
  save(read(analysisPath, { records: {} }), loadCatalog().records);
} finally {
  release();
}
