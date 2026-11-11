import { musicFacts } from "./music-facts.mjs";

export function readBpmSelection(args, readText) {
  const argument = args.find((a) => a.startsWith("--record-ids-file="));
  if (!argument) return null;
  const file = argument.slice("--record-ids-file=".length);
  if (!file.trim()) throw Error("Record selection file is required");
  const ids = JSON.parse(readText(file));
  if (
    !Array.isArray(ids) ||
    ids.length > 1000 ||
    ids.some((id) => typeof id !== "string" || !id.trim() || id.length > 200)
  )
    throw Error(
      "Record selection must contain at most 1000 nonempty record IDs",
    );
  return new Set(ids);
}

export function retryBpmIds(records, analysis, attempted = [], limit = 50) {
  const done = new Set(attempted);
  return records
    .filter((record) => {
      const result = analysis.records?.[record.id];
      return (
        !done.has(record.id) &&
        record.kind !== "artwork" &&
        !musicFacts({ ...record, audioAnalysis: null }).bpm &&
        ["unavailable", "deferred"].includes(result?.status) &&
        result.failureReason !== "size-limit" &&
        !/Duration outside|no audio stream|Invalid analyzer result|exceeds 256 MB/i.test(
          result.error || "",
        )
      );
    })
    .slice(0, limit)
    .map((record) => record.id);
}

export function completedRetryIds(ids, analysis, startedAt) {
  return ids.filter((id) => {
    const result = analysis.records?.[id];
    return (
      result &&
      result.status !== "pending" &&
      Date.parse(result.checkedAt) >= Date.parse(startedAt)
    );
  });
}
