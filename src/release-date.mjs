// Historical dates only: recovery/check timestamps are deliberately ignored.
export function parseHistoricalDate(value) {
  if (typeof value !== "string") return null;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2}))?$/.exec(
      value,
    );
  if (!match) return null;
  const [year, month, day] = match.slice(1, 4).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > days[month - 1] ||
    (match[4] &&
      (Number(match[4]) > 23 || Number(match[5]) > 59 || Number(match[6]) > 59))
  )
    return null;
  const timestamp = Date.parse(match[4] ? value : value + "T00:00:00Z");
  return Number.isFinite(timestamp)
    ? { date: new Date(timestamp).toISOString(), timestamp }
    : null;
}
export function releaseDateForRecord(record, index = {}) {
  const key = `${record.chainId}:${String(record.contract || "").toLowerCase()}`;
  const token = index.tokens?.[`${key}:${record.tokenId}`];
  const contract =
    record.platform === "Sound" && record.legacyEditionId === undefined
      ? index.contracts?.[key]
      : null;
  for (const entry of [token, contract]) {
    if (
      !entry ||
      !["token-created", "release-contract-created"].includes(entry.kind)
    )
      continue;
    const parsed = parseHistoricalDate(entry.date);
    if (parsed)
      return {
        ...parsed,
        kind: entry.kind,
        label:
          entry.kind === "token-created"
            ? "Token created"
            : "Release contract created",
        source: entry.source,
        transaction: entry.transaction || null,
      };
  }
  const supplied = [
    ...new Set(record.musicMetadata?.details?.["Release date"] || []),
  ];
  if (supplied.length === 1) {
    const parsed = parseHistoricalDate(supplied[0]);
    if (parsed)
      return {
        ...parsed,
        kind: "release-metadata",
        label: "Release date supplied by artist",
        source:
          record.musicMetadata.metadataURL ||
          record.musicMetadata.source ||
          null,
      };
  }
  const suppliedIndexDate = record.indexedSourceDate;
  if (
    record.chainId === "solana" &&
    suppliedIndexDate?.kind === "indexed-metadata-date" &&
    suppliedIndexDate.source === "https://api.spinamp.xyz/v3/graphql" &&
    suppliedIndexDate.onchainVerified === false
  ) {
    const parsed = parseHistoricalDate(suppliedIndexDate.date);
    if (parsed)
      return {
        ...parsed,
        kind: "indexed-metadata-date",
        label: "Metadata date · from Spinamp index",
        source: suppliedIndexDate.source,
        onchainVerified: false,
      };
  }
  const indexed = record.indexedNftCreation;
  if (
    indexed?.source === "https://api.spinamp.xyz/v3/graphql" &&
    indexed.onchainVerified === false
  ) {
    const parsed = parseHistoricalDate(indexed.date);
    if (parsed)
      return {
        ...parsed,
        kind: "indexed-token-created",
        label: "Token created · date from Spinamp index",
        source: indexed.source,
        onchainVerified: false,
      };
  }
  return null;
}
export function compareReleaseDates(a, b, direction = "newest") {
  const left = Number.isFinite(a.releaseDate?.timestamp)
    ? a.releaseDate.timestamp
    : null;
  const right = Number.isFinite(b.releaseDate?.timestamp)
    ? b.releaseDate.timestamp
    : null;
  if (left === null && right !== null) return 1;
  if (left !== null && right === null) return -1;
  if (left !== null && right !== null && left !== right)
    return direction === "oldest" ? left - right : right - left;
  return String(a.id || "").localeCompare(String(b.id || ""));
}
