import { readFileSync } from "node:fs";
export function readAnalysisCheckpoint(path) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return { records: {} };
    throw error;
  }
  const value = JSON.parse(text);
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !value.records ||
    typeof value.records !== "object" ||
    Array.isArray(value.records)
  )
    throw Error(
      "Invalid BPM checkpoint: expected a records object; existing data was not replaced",
    );
  return value;
}
