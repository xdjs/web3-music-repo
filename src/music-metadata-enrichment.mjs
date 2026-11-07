// Add explicit source facts without removing previously recovered evidence.
const fields = ["bpms", "keys", "collaborators", "credits"];
const unique = (values) => [...new Set(values)];
export function mergeMusicMetadataFacts(previous = {}, incoming = {}) {
  const result = {};
  for (const field of fields)
    result[field] = unique([
      ...(previous[field] || []),
      ...(incoming[field] || []),
    ]);
  result.details = {};
  for (const source of [previous, incoming])
    for (const [key, values] of Object.entries(source.details || {}))
      result.details[key] = unique([...(result.details[key] || []), ...values]);
  for (const field of ["lyrics", "lyricsReferences"]) {
    const seen = new Set();
    const values = [
      ...(previous[field] || []),
      ...(incoming[field] || []),
    ].filter((v) => {
      const key = v.text || v.url;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (values.length) result[field] = values;
  }
  if (result.lyrics?.length) result.hasLyrics = true;
  if (incoming.lyricsOmittedReason || previous.lyricsOmittedReason)
    result.lyricsOmittedReason =
      incoming.lyricsOmittedReason || previous.lyricsOmittedReason;
  return result;
}
export function hasAdditionalMusicFacts(previous, incoming) {
  return (
    JSON.stringify(mergeMusicMetadataFacts(previous)) !==
    JSON.stringify(mergeMusicMetadataFacts(previous, incoming))
  );
}
export function metadataSnapshotKey(record) {
  return typeof record.contract === "string" &&
    /^0x[0-9a-f]{40}$/i.test(record.contract) &&
    record.tokenId != null
    ? `${record.chainId}-${record.contract.toLowerCase()}-${record.tokenId}`
    : null;
}
