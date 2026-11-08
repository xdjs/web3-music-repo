import { createHash } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { downloadBpmMedia } from "./bpm-media-download.mjs";
const exec = promisify(execFile);
export async function analyzeBpmMedia(
  source,
  {
    binary = "open-bpm",
    workDirectory = "work/bpm-audio",
    downloadOptions = {},
  } = {},
) {
  await mkdir(workDirectory, { recursive: true });
  const id = createHash("sha256").update(source).digest("hex"),
    input = `${workDirectory}/${id}.media`,
    wav = `${workDirectory}/${id}.wav`;
  let fetched;
  try {
    fetched = await downloadBpmMedia(source, input, downloadOptions);
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
        await exec(binary, ["--format", "json", wav], {
          timeout: 120000,
          maxBuffer: 1024 * 1024,
          env: { ...process.env, RAYON_NUM_THREADS: "2" },
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
      ...fetched,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (fetched) error.transfer = fetched;
    throw error;
  } finally {
    await rm(input, { force: true });
    await rm(wav, { force: true });
  }
}
