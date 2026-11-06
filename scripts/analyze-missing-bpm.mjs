import { acquireRecoveryLock } from "../src/recovery-job-lock.mjs";
import {
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  rmSync,
  createWriteStream,
  existsSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform, Readable } from "node:stream";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createCatalogLoader } from "../src/catalog-bundle.mjs";
import { storageURL } from "../src/nft-reader.mjs";
import { musicFacts } from "../src/music-facts.mjs";
const exec = promisify(execFile),
  load = createCatalogLoader(),
  initial = load();
const read = (p, f) => {
  try {
    return JSON.parse(readFileSync(p));
  } catch {
    return f;
  }
};
const file = "data/audio-analysis.json";
const releaseLock = acquireRecoveryLock(file);
const state = read(file, { records: {} }),
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
const jobs = initial.records
  .filter(
    (r) =>
      r.kind !== "artwork" &&
      ((retry && state.records[r.id]?.status === "unavailable") ||
        !state.records[r.id] ||
        state.records[r.id].status === "pending"),
  )
  .slice(0, max);
const concurrency = Number(
  process.argv.find((a) => a.startsWith("--concurrency="))?.slice(14) || 2,
);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4)
  throw Error("Concurrency must be an integer from 1 to 4");
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
async function download(source, path) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await new Promise((r) =>
      setTimeout(r, Math.max(0, cooldownUntil - Date.now())),
    );
    try {
      return await downloadOnce(source, path);
    } catch (error) {
      if (!error.message.includes("429") || attempt === 2) throw error;
      cooldownUntil = Math.max(
        cooldownUntil,
        Date.now() + 30000 * (attempt + 1),
      );
    }
  }
}
async function downloadOnce(source, path) {
  let url = storageURL(source);
  for (let redirects = 0; redirects < 4; redirects++) {
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(90000),
    });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      url = storageURL(new URL(res.headers.get("location"), url).href);
      await res.body?.cancel();
      continue;
    }
    if (!res.ok) throw Error("Media HTTP " + res.status);
    let bytes = 0;
    const hash = createHash("sha256");
    await pipeline(
      Readable.fromWeb(res.body),
      new Transform({
        transform(chunk, enc, cb) {
          bytes += chunk.length;
          if (bytes > 256 * 1024 * 1024)
            return cb(Error("Media exceeds 256 MB analysis limit"));
          hash.update(chunk);
          cb(null, chunk);
        },
      }),
      createWriteStream(path),
    );
    return { sha256: hash.digest("hex"), bytes, url };
  }
  throw Error("Redirect limit");
}
const mediaResults = new Map();
let next = 0,
  done = 0;
async function analyze(r, source) {
  const id = createHash("sha256").update(source).digest("hex"),
    input = `${work}/${id}.media`,
    wav = `${work}/${id}.wav`;
  try {
    const fetched = await download(source, input);
    const probe = JSON.parse(
      (
        await exec(
          "ffprobe",
          [
            "-v",
            "error",
            "-show_entries",
            "format=duration:stream=codec_type",
            "-of",
            "json",
            input,
          ],
          { timeout: 20000 },
        )
      ).stdout,
    );
    const duration = Number(probe.format?.duration);
    if (!probe.streams?.some((s) => s.codec_type === "audio"))
      throw Error("Media contains no audio stream");
    if (!Number.isFinite(duration) || duration < 10 || duration > 1800)
      throw Error("Duration outside 10–1800 second analysis range");
    await exec(
      "ffmpeg",
      [
        "-v",
        "error",
        "-y",
        "-i",
        input,
        "-map",
        "0:a:0",
        "-vn",
        "-ac",
        "1",
        "-ar",
        "22050",
        wav,
      ],
      { timeout: 120000, maxBuffer: 1024 * 1024 },
    );
    const result = JSON.parse(
      (
        await exec(bin, ["--format", "json", wav], {
          timeout: 120000,
          maxBuffer: 1024 * 1024,
        })
      ).stdout,
    );
    if (
      !Number.isFinite(result.bpm) ||
      result.bpm < 20 ||
      result.bpm > 400 ||
      !Number.isFinite(result.confidence) ||
      result.confidence < 0 ||
      result.confidence > 1
    )
      throw Error("Invalid analyzer result");
    return {
      status: result.confidence < 0.3 ? "needs-review" : "estimated",
      bpm: result.bpm,
      confidence: result.confidence,
      gridOffset: result.grid_offset,
      durationSeconds: duration,
      source,
      ...fetched,
      checkedAt: new Date().toISOString(),
    };
  } finally {
    rmSync(input, { force: true });
    rmSync(wav, { force: true });
  }
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
          status: "unavailable",
          error: e.message,
          source,
          checkedAt: new Date().toISOString(),
        };
        mediaResults.delete(source);
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
