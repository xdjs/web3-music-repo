import { musicFacts } from "./music-facts.mjs";
export const summarizeBpmCoverage = (rows) => {
  const summary = {
    recordings: rows.length,
    supplied: 0,
    estimated: 0,
    missing: 0,
    deferred: 0,
    missingByAnalysisState: {},
  };
  for (const record of rows) {
    const supplied = musicFacts({ ...record, audioAnalysis: null }).bpm;
    const displayed = musicFacts(record).bpm;
    if (supplied) summary.supplied++;
    else if (displayed) summary.estimated++;
    else {
      summary.missing++;
      if (record.audioAnalysis?.status === "deferred") summary.deferred++;
      const status = record.audioAnalysis?.status || "not-analyzed";
      summary.missingByAnalysisState[status] =
        (summary.missingByAnalysisState[status] || 0) + 1;
    }
  }
  summary.withBpm = summary.supplied + summary.estimated;
  summary.percentWithBpm = rows.length
    ? Math.round((1000 * summary.withBpm) / rows.length) / 10
    : 0;
  if (summary.withBpm + summary.missing !== rows.length)
    throw Error("BPM coverage does not reconcile");
  return summary;
};
