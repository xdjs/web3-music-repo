export function expansionCoverage(modern, fallback) {
  const attempts = { ...modern.attempts };
  for (const [k, v] of Object.entries(fallback.attempts || {})) {
    if (
      attempts[k]?.status !== "live" &&
      ["live", "unminted"].includes(v.status)
    )
      attempts[k] = v;
  }
  const list = Object.values(attempts);
  return {
    attempted: list.length,
    recovered: list.filter((x) => x.status === "live").length,
    unminted: list.filter((x) => x.status === "unminted").length,
    unresolved: list.filter((x) => !["live", "unminted"].includes(x.status))
      .length,
    updatedAt: modern.updatedAt,
    finishedAt: modern.finishedAt || null,
  };
}

export function catalogCoverage(inventory, archived, verified) {
  const records = inventory.records || [];
  const known = new Set(records.map((r) => r.id));
  return {
    source: inventory.source,
    snapshotDate: inventory.snapshotDate,
    tokenEntries: records.length,
    ethereum: records.filter((r) => r.chainId === 1).length,
    base: records.filter((r) => r.chainId === 8453).length,
    indexedMedia: Object.entries(archived.evidence || {}).filter(
      ([id, v]) => known.has(id) && v.mediaURI,
    ).length,
    currentMetadata: Object.entries(verified.evidence || {}).filter(
      ([id, v]) => known.has(id) && v.status === "live",
    ).length,
    checkedAt: verified.updatedAt,
    scope:
      "Official published snapshot; token entries are not unique songs or proof of a complete current catalog.",
  };
}
