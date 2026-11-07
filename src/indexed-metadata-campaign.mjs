export function metadataBatchDecision(report, exitCode) {
  if (exitCode !== 0) return { continue: false, reason: "worker-exit-failure" };
  if (report.stoppedReason || report.interrupted)
    return { continue: false, reason: report.stoppedReason || "interrupted" };
  if (report.selectedRecords === 0)
    return { continue: false, reason: "eligible-cohort-exhausted" };
  if (!Number.isInteger(report.read) || report.read <= 0)
    return { continue: false, reason: "no-successful-progress" };
  return { continue: true, reason: "successful-progress" };
}
