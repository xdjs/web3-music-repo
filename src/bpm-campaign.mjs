import { musicFacts } from "./music-facts.mjs";
export function campaignEligible(record, analysis) {
  return (
    record.kind !== "artwork" &&
    !musicFacts({ ...record, audioAnalysis: null }).bpm &&
    (!analysis || analysis.status === "pending")
  );
}
export function campaignPlan(
  records,
  analysis,
  lastPlatform = null,
  batchSize = 50,
) {
  const groups = new Map();
  for (const record of records) {
    if (!campaignEligible(record, analysis.records?.[record.id])) continue;
    const group = groups.get(record.platform) || [];
    group.push(record.id);
    groups.set(record.platform, group);
  }
  const platforms = [...groups]
    .map(([platform, ids]) => ({ platform, remaining: ids.length, ids }))
    .sort(
      (a, b) =>
        b.remaining - a.remaining || a.platform.localeCompare(b.platform),
    );
  const sound = platforms.find((p) => p.platform === "Sound");
  // Finish the original Sound pass first, including a resumable interruption.
  const ranked = sound ? [sound] : platforms;
  // Alphabetical circular order is stable even as per-platform counts fall.
  const fair = ranked
    .slice()
    .sort((a, b) => a.platform.localeCompare(b.platform));
  const next =
    sound ||
    fair.find((p) => !lastPlatform || p.platform > lastPlatform) ||
    fair[0];
  return {
    remaining: platforms.reduce((sum, p) => sum + p.remaining, 0),
    platforms: platforms.map(({ platform, remaining }) => ({
      platform,
      remaining,
    })),
    next: next
      ? { platform: next.platform, recordIds: next.ids.slice(0, batchSize) }
      : null,
  };
}
export function isProviderFailure(result) {
  return (
    result?.status === "unavailable" &&
    /timeout|timed out|aborted|fetch failed|ECONN|ENOTFOUND|EAI_AGAIN|network|Media HTTP (?:429|5\d\d)/i.test(
      result.error || "",
    )
  );
}
export function providerCircuit(results) {
  const tail = results.slice(-10),
    failures = tail.filter(isProviderFailure).length;
  const rateLimited = tail.filter(
    (r) => isProviderFailure(r) && /429/.test(r.error || ""),
  ).length;
  return {
    stop:
      (tail.length >= 10 && failures >= 8) ||
      (tail.length >= 5 && rateLimited >= 4),
    sample: tail.length,
    failures,
    rateLimited,
  };
}
export function campaignCounts(records, analysis) {
  const totals = {
    records: records.length,
    supplied: 0,
    estimated: 0,
    needsReview: 0,
    unavailable: 0,
    pending: 0,
    untouched: 0,
    other: 0,
  };
  for (const r of records) {
    const a = analysis.records?.[r.id];
    if (musicFacts({ ...r, audioAnalysis: null }).bpm) totals.supplied++;
    else if (a?.status === "estimated") totals.estimated++;
    else if (a?.status === "needs-review") totals.needsReview++;
    else if (a?.status === "unavailable") totals.unavailable++;
    else if (a?.status === "pending") totals.pending++;
    else if (!a) totals.untouched++;
    else totals.other++;
  }
  return totals;
}
