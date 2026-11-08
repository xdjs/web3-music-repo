import { musicFacts } from "./music-facts.mjs";
import { storageURL } from "./nft-reader.mjs";

const pick = (object, keys) =>
  Object.fromEntries(
    keys
      .filter((key) => object?.[key] !== undefined && object[key] !== null)
      .map((key) => [key, object[key]]),
  );

// Full evidence stays available through the original export and per-record API.
export function presentRecord(record, evidence) {
  let imageURL;
  try {
    imageURL = storageURL(record.imageURI);
  } catch {}
  return { ...record, imageURL, recovery: evidence || null };
}

export function indexRecord(record, evidence) {
  const full = presentRecord(record, evidence);
  const result = pick(full, [
    "id",
    "assetType",
    "mintStatus",
    "title",
    "artist",
    "artistId",
    "platform",
    "collection",
    "chainId",
    "mint",
    "contract",
    "tokenId",
    "standard",
    "kind",
    "mediaScope",
    "originalRelease",
  ]);
  result.personIds = [
    ...new Set([
      ...(record.personIds || []),
      ...(record.credits || [])
        .map((credit) => credit.personId)
        .filter(Boolean),
    ]),
  ];
  // Preserve original Sound recognition even if a recovered record lacks platform.
  if (record.originalRelease?.includes("sound.xyz")) result.platform = "Sound";
  result.imageURL =
    evidence?.localImage || evidence?.imageURL || full.imageURL || "";
  result.recovery = evidence
    ? pick(evidence, [
        "status",
        "sourceType",
        "mediaURL",
        "mediaURI",
        "mediaSourceType",
        "blockNumber",
      ])
    : null;
  if (record.playback?.workingURL)
    result.playback = {
      workingURL: record.playback.workingURL,
      ...(record.playback.sourceType
        ? { sourceType: record.playback.sourceType }
        : {}),
    };
  if (record.releaseDate)
    result.releaseDate = pick(record.releaseDate, ["timestamp", "date"]);
  const facts = musicFacts(record);
  if (facts.bpm || facts.key) result.musicFacts = facts;
  const collaborators = [
    ...new Set([
      ...(record.musicMetadata?.collaborators || []),
      ...(record.musicMetadata?.credits || []),
      ...(record.archivedCredits || []),
    ]),
  ];
  if (collaborators.length) result.searchCredits = collaborators.join(" ");
  return result;
}
