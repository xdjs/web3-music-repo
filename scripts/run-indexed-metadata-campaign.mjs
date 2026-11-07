import {
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  openSync,
  closeSync,
} from "node:fs";
import { spawn } from "node:child_process";
import { acquireRecoveryLock } from "../src/recovery-job-lock.mjs";
import { metadataBatchDecision } from "../src/indexed-metadata-campaign.mjs";
const campaignId = process.argv
  .find((a) => a.startsWith("--campaign-id="))
  ?.slice(14);
if (!campaignId || !/^[a-zA-Z0-9-]{1,100}$/.test(campaignId))
  throw Error("Explicit safe --campaign-id required");
const statusPath = "data/indexed-metadata-campaign-status.json";
const release = acquireRecoveryLock(statusPath);
const read = (p) => JSON.parse(readFileSync(p));
const status = {
  campaignId,
  pid: process.pid,
  startedAt: new Date().toISOString(),
  status: "running",
  scope:
    "Exact imported NFT identities; public indexed metadata, not independent chain verification",
  batches: [],
};
let stopped = false,
  child;
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    stopped = true;
    child?.kill("SIGTERM");
  });
const save = () => {
  status.updatedAt = new Date().toISOString();
  const c = read("data/metadata-enrichment-checkpoint.json");
  status.successfulIdentities = Object.keys(c.records).length;
  status.retryableFailures = Object.keys(c.failures || {}).length;
  writeFileSync(statusPath + ".tmp", JSON.stringify(status, null, 2));
  renameSync(statusPath + ".tmp", statusPath);
};
mkdirSync("work/indexed-metadata-campaign", { recursive: true });
try {
  save();
  for (let i = 0; i < 28 && !stopped; i++) {
    const startedAt = new Date().toISOString();
    const log = `work/indexed-metadata-campaign/${startedAt.replaceAll(":", "-")}.log`;
    const fd = openSync(log, "wx");
    const exitCode = await new Promise((resolve, reject) => {
      child = spawn(
        process.execPath,
        [
          "scripts/recover-indexed-music-metadata.mjs",
          "--limit=1000",
          `--campaign-id=${campaignId}`,
        ],
        { stdio: ["ignore", fd, fd] },
      );
      child.once("error", reject);
      child.once("exit", resolve);
    }).finally(() => {
      closeSync(fd);
      child = null;
    });
    const report = read("data/metadata-enrichment-audit.json");
    if (report.campaignId !== campaignId || report.startedAt < startedAt)
      throw Error("Missing fresh child receipt");
    const decision = metadataBatchDecision(report, exitCode);
    status.batches.push({
      batchId: report.batchId,
      selected: report.selectedRecords,
      read: report.read,
      improved: report.improved,
      failures: report.failures.length,
      exitCode,
      receipt: `data/metadata-enrichment-batches/${report.batchId}.json`,
    });
    save();
    console.log(
      JSON.stringify({
        successfulIdentities: status.successfulIdentities,
        batch: status.batches.at(-1),
        decision,
      }),
    );
    if (!decision.continue) {
      status.status = decision.reason;
      break;
    }
  }
  if (status.status === "running")
    status.status = stopped ? "interrupted" : "batch-limit-reached";
  status.finishedAt = new Date().toISOString();
  save();
} catch (error) {
  status.status = "coordinator-error";
  status.error = String(error.message);
  save();
  process.exitCode = 1;
} finally {
  release();
}
