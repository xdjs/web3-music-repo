import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { analyzeBpmMedia } from "../src/bpm-audio-analysis.mjs";
const recordings = [
  {
    id: "spinamp-b30dca6e0dd0386117e1",
    title: "Busy",
    cid: "QmdGgTkMihQ4RfMjCETnMiNg4RLCAR9pkC4pHHJPd1qJXL",
    expectedBytes: 175832658,
  },
  {
    id: "spinamp-7954ce12c4346333b51a",
    title: "DGTZD",
    cid: "QmZzSDVkZFXNFSpT7yvp7Aq8c4MKfgjAC4Pnz8uRhGLq8F",
    expectedBytes: 141093465,
  },
];
const report = {
  startedAt: new Date().toISOString(),
  scope:
    "Two original large IPFS videos only, isolated analysis proof; no catalog/checkpoint writes, no listening copy published",
  budgets: {
    perSourceBytes: 200 * 1024 * 1024,
    totalSourceBytes: 400 * 1024 * 1024,
    perSourceTransferMs: 180000,
    connectionMs: 15000,
    idleMs: 15000,
    concurrency: 1,
    analysisThreads: 2,
  },
  records: [],
};
mkdirSync("work/bpm-transfer-proof", { recursive: true });
for (const r of recordings) {
  const source = `https://gateway.pinata.cloud/ipfs/${r.cid}`;
  const started = Date.now();
  let record = { ...r, source };
  try {
    const result = await analyzeBpmMedia(source, {
      binary: resolve("../.music-recovery-tools/cargo/bin/open-bpm"),
      workDirectory: "work/bpm-transfer-proof",
      downloadOptions: {
        connectionTimeoutMs: 15000,
        idleTimeoutMs: 15000,
        totalTimeoutMs: 180000,
        maxBytes: 200 * 1024 * 1024,
      },
    });
    record = {
      ...record,
      ...result,
      wallMs: Date.now() - started,
      expectedLengthMatched: result.bytes === r.expectedBytes,
    };
  } catch (error) {
    record = {
      ...record,
      status: error.deferred ? "deferred" : "unavailable",
      error: error.message,
      reason: error.reason,
      attempts: error.attempts || error.transfer?.attempts,
      wallMs: Date.now() - started,
    };
  }
  report.records.push(record);
  report.updatedAt = new Date().toISOString();
  writeFileSync(
    "data/bpm-large-transfer-verification.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      id: r.id,
      status: record.status,
      bpm: record.bpm,
      bytes: record.bytes,
      wallMs: record.wallMs,
      reason: record.reason,
    }),
  );
}
report.finishedAt = new Date().toISOString();
writeFileSync(
  "data/bpm-large-transfer-verification.json",
  JSON.stringify(report, null, 2),
);
