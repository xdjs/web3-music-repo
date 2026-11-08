export const TRACK_METADATA_SOURCE = "https://api.spinamp.xyz/v3/graphql";
export const TRACK_METADATA_QUERY = `query RecoveryTrackMetadata($after:Cursor,$first:Int!){allProcessedTracks(first:$first,after:$after,orderBy:PRIMARY_KEY_ASC){totalCount pageInfo{hasNextPage endCursor}nodes{id title artistId platformId platformInternalId lossyAudioUrl lossyAudioIpfsHash lossyArtworkUrl lossyArtworkIpfsHash description lossyAudioMimeType lossyArtworkMimeType chorusStart supportingArtist artistBySupportingArtist{id name slug}}}}`;
export const TRACK_SNAPSHOT_FIELDS = [
  "id",
  "title",
  "artistId",
  "platformId",
  "platformInternalId",
  "lossyAudioUrl",
  "lossyAudioIpfsHash",
  "lossyArtworkUrl",
  "lossyArtworkIpfsHash",
];
const nullableString = (value) => value === null || typeof value === "string";
export function validateTrackMetadataPage(
  body,
  { after = null, first = 500, snapshot, seen = new Set() },
) {
  if (body?.errors?.length)
    throw Error(body.errors[0].message || "GraphQL provider error");
  const page = body?.data?.allProcessedTracks;
  if (
    !page ||
    !Array.isArray(page.nodes) ||
    page.nodes.length > first ||
    !Number.isSafeInteger(page.totalCount) ||
    page.totalCount < 0 ||
    typeof page.pageInfo?.hasNextPage !== "boolean" ||
    !nullableString(page.pageInfo.endCursor)
  )
    throw Error("Incomplete processed-track page");
  if (
    page.pageInfo.hasNextPage &&
    (!page.nodes.length ||
      !page.pageInfo.endCursor ||
      page.pageInfo.endCursor === after)
  )
    throw Error("Empty or repeated nonterminal cursor");
  const pageIds = new Set(),
    rows = [];
  for (const row of page.nodes) {
    if (
      typeof row?.id !== "string" ||
      !row.id ||
      seen.has(row.id) ||
      pageIds.has(row.id)
    )
      throw Error("Missing or repeated processed-track identity");
    pageIds.add(row.id);
    for (const key of [
      ...TRACK_SNAPSHOT_FIELDS.slice(1),
      "description",
      "lossyAudioMimeType",
      "lossyArtworkMimeType",
      "supportingArtist",
    ])
      if (!nullableString(row[key])) throw Error("Invalid scalar " + key);
    if (row.description && row.description.length > 1024 * 1024)
      throw Error("Description exceeds bounded preservation size");
    if (
      row.chorusStart !== null &&
      !(
        typeof row.chorusStart === "string" &&
        /^-?\d+(?:\.\d+)?$/.test(row.chorusStart)
      )
    )
      throw Error("Invalid chorusStart scalar");
    if (row.artistBySupportingArtist !== null) {
      const a = row.artistBySupportingArtist;
      if (
        !a ||
        typeof a.id !== "string" ||
        a.id !== row.supportingArtist ||
        !nullableString(a.name) ||
        !nullableString(a.slug)
      )
        throw Error("Supporting artist identity mismatch");
    }
    const previous = snapshot.get(row.id);
    const mismatches = previous
      ? TRACK_SNAPSHOT_FIELDS.filter(
          (key) => (previous[key] ?? null) !== row[key],
        )
      : [];
    rows.push({
      id: row.id,
      status: !previous
        ? "outside-frozen-snapshot"
        : mismatches.length
          ? "snapshot-changed"
          : "matched",
      mismatches,
    });
  }
  return { page, rows };
}
export function trackMetadataCounts(rows) {
  const result = {
    rows: rows.length,
    descriptions: 0,
    descriptionCharacters: 0,
    audioMime: {},
    artworkMime: {},
    supportingArtists: 0,
    supportingProfiles: 0,
    nonzeroChorusStart: 0,
  };
  for (const row of rows) {
    if (row.description?.trim()) {
      result.descriptions++;
      result.descriptionCharacters += row.description.length;
    }
    for (const [field, group] of [
      ["lossyAudioMimeType", "audioMime"],
      ["lossyArtworkMimeType", "artworkMime"],
    ]) {
      const key = row[field] || "unknown";
      result[group][key] = (result[group][key] || 0) + 1;
    }
    if (row.supportingArtist) result.supportingArtists++;
    if (row.artistBySupportingArtist) result.supportingProfiles++;
    if (row.chorusStart !== null && Number(row.chorusStart) > 0)
      result.nonzeroChorusStart++;
  }
  return result;
}
