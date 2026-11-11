import {
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
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
  campaignConcurrency,
} from "../src/bpm-campaign.mjs";
import { retryBpmIds, completedRetryIds } from "../src/bpm-retry-plan.mjs";

const directory = "work/bpm-recovery-supervisor";
const statusPath = "data/bpm-recovery-supervisor.json";
const analysisPath = "data/audio-analysis.json";
const load = createCatalogLoader();
const concurrency = campaignConcurrency(process.argv.slice(2));
const read = (file, fallback) => {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return fallback;
    throw e;
  }
};
const health = (lock) => {
  if (
    !lock ||
    lock.cwd !== process.cwd() ||
    !Number.isInteger(lock.pid) ||
    lock.pid <= 1
  )
    throw Error("Unrecognized worker lock; inspect before restarting");
  try {
    process.kill(lock.pid, 0);
    return "alive";
  } catch (e) {
    if (e.code === "ESRCH") return "stale";
    throw e;
  }
};
if (process.argv.includes("--inspect")) {
  const analysis = read(analysisPath, { records: {} }),
    records = load().records;
  console.log(
    JSON.stringify({
      firstPassRemaining: campaignPlan(records, analysis).remaining,
      retryCandidates: retryBpmIds(records, analysis, [], records.length)
        .length,
      counts: campaignCounts(records, analysis),
    }),
  );
  process.exit(0);
}
const release = acquireRecoveryLock(statusPath);
const status = {
  ...read(statusPath, {}),
  pid: process.pid,
  startedAt: new Date().toISOString(),
  state: "starting",
  concurrency,
  externalWorkers: [],
  activeChild: null,
  reason: null,
};
let stopping = false,
  child = null;
mkdirSync(directory, { recursive: true });
const requestStop = () => {
  if (stopping) return;
  stopping = true;
  if (child) child.kill("SIGTERM");
};
process.once("SIGTERM", requestStop);
process.once("SIGINT", requestStop);
const save = () => {
  const analysis = read(analysisPath, { records: {} });
  status.updatedAt = new Date().toISOString();
  status.counts = campaignCounts(load().records, analysis);
  if (status.lastCheckpointCount === undefined)
    status.lastCheckpointCount = status.counts.estimated;
  if (status.counts.estimated - status.lastCheckpointCount >= 500) {
    writeFileSync(
      directory + "/latest-checkpoint.json.tmp",
      JSON.stringify(analysis),
    );
    renameSync(
      directory + "/latest-checkpoint.json.tmp",
      directory + "/latest-checkpoint.json",
    );
    status.lastCheckpointCount = status.counts.estimated;
    status.lastCheckpointAt = status.updatedAt;
  }
  writeFileSync(statusPath + ".tmp", JSON.stringify(status, null, 2));
  renameSync(statusPath + ".tmp", statusPath);
};
const sleep = () => new Promise((resolve) => setTimeout(resolve, 10000));
const cooldown = () => {
  status.providerStops = (status.providerStops || 0) + 1;
  status.cooldownUntil =
    Date.now() +
    Math.min(60, 15 * 2 ** Math.min(status.providerStops - 1, 2)) * 60000;
};
async function run(args, phase) {
  const began = new Date().toISOString();
  const fd = openSync(`${directory}/${began.replace(/[:.]/g, "-")}.log`, "a");
  child = spawn(process.execPath, args, {
    stdio: ["ignore", fd, fd],
    env: { ...process.env, RAYON_NUM_THREADS: "2" },
  });
  status.activeChild = { pid: child.pid, phase, startedAt: began };
  status.state = phase;
  save();
  const timer = setInterval(() => {
    try {
      if (existsSync(directory + "/STOP")) requestStop();
      save();
    } catch (e) {
      status.reason = e.message;
      requestStop();
    }
  }, 10000);
  let result;
  try {
    result = await new Promise((resolve) => {
      child.once("error", (error) =>
        resolve({ code: 1, error: error.message }),
      );
      child.once("exit", (code, signal) => resolve({ code, signal }));
    });
  } finally {
    clearInterval(timer);
    closeSync(fd);
    child = null;
    status.activeChild = null;
  }
  if (result.code !== 0 && !stopping)
    throw Error(`Worker exited unsuccessfully; inspect ${directory} logs`);
  const analysis = read(analysisPath, { records: {} });
  if (phase === "retry") {
    status.attempted = [
      ...new Set([
        ...(status.attempted || []),
        ...completedRetryIds(status.retryIds, analysis, began),
      ]),
    ];
    if (analysis.lastPass?.stopReason === "provider-failures") cooldown();
    else status.providerStops = 0;
  }
  save();
}
try {
  while (!stopping) {
    if (existsSync(directory + "/STOP")) break;
    status.externalWorkers = [];
    for (const file of [
      "data/bpm-campaign-status.json.lock",
      analysisPath + ".lock",
    ]) {
      const lock = read(file, null);
      if (!lock) continue;
      if (health(lock) !== "alive")
        throw Error(`Stale worker lock at ${file}; not removed automatically`);
      status.externalWorkers.push({
        pid: lock.pid,
        cwd: lock.cwd,
        startedAt: lock.startedAt,
      });
    }
    if (status.externalWorkers.length) {
      status.state = "waiting-existing-worker";
      save();
      await sleep();
      continue;
    }
    const campaign = read("data/bpm-campaign-status.json", {});
    if (
      /provider-failures/.test(campaign.state || "") &&
      status.observedProviderStopAt !== campaign.updatedAt
    ) {
      status.observedProviderStopAt = campaign.updatedAt;
      cooldown();
    }
    if (Date.now() < (status.cooldownUntil || 0)) {
      status.state = "provider-cooldown";
      save();
      await sleep();
      continue;
    }
    const analysis = read(analysisPath, { records: {} }),
      records = load().records;
    if (campaignPlan(records, analysis).remaining) {
      await run(
        ["scripts/run-bpm-campaign.mjs", `--concurrency=${concurrency}`],
        "first-pass",
      );
      continue;
    }
    if (
      status.retryRoundFinishedAt &&
      Date.now() - Date.parse(status.retryRoundFinishedAt) < 24 * 3600000
    ) {
      status.state = "waiting-next-retry-round";
      save();
      await sleep();
      continue;
    }
    if (!status.retryRoundStartedAt || status.retryRoundFinishedAt) {
      status.retryRoundStartedAt = new Date().toISOString();
      status.retryRoundFinishedAt = null;
      status.attempted = [];
    }
    const ids = retryBpmIds(records, analysis, status.attempted);
    if (!ids.length) {
      status.retryRoundFinishedAt = new Date().toISOString();
      status.state = "retry-round-complete";
      save();
      continue;
    }
    status.retryIds = ids;
    writeFileSync(directory + "/retry-ids.json", JSON.stringify(ids));
    await run(
      [
        "scripts/analyze-missing-bpm.mjs",
        "--retry",
        "--retry-deferred",
        `--concurrency=${concurrency}`,
        "--limit=50",
        "--download-timeout-ms=20000",
        "--total-transfer-timeout-ms=300000",
        `--record-ids-file=${directory}/retry-ids.json`,
      ],
      "retry",
    );
  }
  status.state = status.reason ? "blocked" : "stopped";
} catch (e) {
  status.state = "blocked";
  status.reason = e.message;
  process.exitCode = 1;
} finally {
  try {
    save();
  } finally {
    release();
  }
}
