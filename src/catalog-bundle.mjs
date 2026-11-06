import { releaseDateForRecord } from "./release-date.mjs";
import { readFileSync, statSync } from "node:fs";
import { nftCatalog as baseCatalog } from "./nft-catalog.js";
import { people as basePeople, sources } from "./data.js";
const slug = (s) =>
  String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export function mediaKind(record, evidence) {
  const uri = evidence?.mediaURI || "";
  const image = evidence?.imageURI || record.imageURI || "";
  if (
    (uri && image && uri === image) ||
    /\.(png|jpe?g|gif|webp|svg)(?:[?#]|$)/i.test(uri)
  )
    return "artwork";
  return record.kind || "audio";
}
export function mergeCatalog(base, baseEvidence, bundles, people) {
  const records = base.map((r) => ({ ...r })),
    evidence = { ...baseEvidence };
  const tokenKey = (r) =>
    `${r.chainId}:${r.contract.toLowerCase()}:${r.tokenId}`;
  const mediaKey = (r, v) =>
    `${r.chainId}:${r.contract.toLowerCase()}:${v?.mediaURI || ""}`;
  const tokens = new Map(records.map((r) => [tokenKey(r), r]));
  const media = new Map(
    records
      .filter((r) => evidence[r.id]?.mediaURI)
      .map((r) => [mediaKey(r, evidence[r.id]), r]),
  );
  const byName = new Map([
    ...base.map((r) => [
      r.artist.trim().toLowerCase(),
      r.artistId || slug(r.artist),
    ]),
    ...people.flatMap((p) =>
      [p.name, ...(p.aliases || [])].map((n) => [n.trim().toLowerCase(), p.id]),
    ),
  ]);
  const addedPeople = new Map();
  for (const bundle of bundles) {
    for (const r of bundle.records || []) {
      const v = bundle.evidence?.[r.id];
      if (!["live", "indexed"].includes(v?.status)) continue;
      const existing = tokens.get(tokenKey(r)) || media.get(mediaKey(r, v));
      if (existing) {
        if (v.status === "live" && evidence[existing.id]?.status === "indexed")
          evidence[existing.id] = v;
        for (const k of [
          "legacyEditionId",
          "editionSupply",
          "creator",
          "factory",
          "factoryVersion",
          "originalRelease",
        ])
          if (existing[k] === undefined && r[k] !== undefined)
            existing[k] = r[k];
        continue;
      }
      const artistId =
        byName.get(r.artist.trim().toLowerCase()) || "artist-" + slug(r.artist);
      const entry = {
        ...r,
        artistId,
        personIds: [
          ...new Set([
            artistId,
            ...(r.personIds || []),
            ...(r.credits || []).map((c) => c.personId),
          ]),
        ].filter((id) => id === artistId || people.some((p) => p.id === id)),
        origin: "recovered",
      };
      records.push(entry);
      tokens.set(tokenKey(entry), entry);
      media.set(mediaKey(entry, v), entry);
      evidence[entry.id] = v;
      if (!people.some((p) => p.id === artistId) && !addedPeople.has(artistId))
        addedPeople.set(artistId, {
          id: artistId,
          name: r.artist,
          kind: "Artist",
          bio: "Artist attribution recovered from original release metadata. This profile is not a verified complete discography.",
          links: [],
          sources: [],
        });
    }
  }
  return { records, evidence, people: [...people, ...addedPeople.values()] };
}
export function createCatalogLoader() {
  let cached = null,
    lastCheck = 0,
    signature = "";
  return () => {
    if (cached && Date.now() - lastCheck < 10000) return cached;
    lastCheck = Date.now();
    const paths = [
      "data/recovery-snapshot.json",
      "data/sound-expanded.json",
      "data/legacy-expanded.json",
      "data/playback-audit.json",
      "data/sound-fallback.json",
      "data/expanded-playback-audit.json",
      "data/catalog/archived-media.json",
      "data/catalog/live-verification.json",
      "data/zora-expanded.json",
      "data/music-metadata.json",
      "data/audio-analysis.json",
      "data/catalog/song-revenue.json",
      "data/verified-credits.json",
      "data/mint-songs/archived-media.json",
      "data/pete-recovery/recovered-media.json",
      "data/sound-resolution/archived-recovery.json",
      "data/catalog/ethereum-revenue-audit.json",
      "data/release-dates.json",
      "data/pete-recovery/zora-recovered-media.json",
    ];
    const next = paths
      .map((p) => {
        try {
          return statSync(p).mtimeMs;
        } catch {
          return 0;
        }
      })
      .join("|");
    if (cached && signature === next) return cached;
    const read = (p, fallback) => {
      try {
        return JSON.parse(readFileSync(p, "utf8"));
      } catch {
        return fallback;
      }
    };
    const peteZora = read(paths[18], {});
    const merged = mergeCatalog(
      baseCatalog,
      read(paths[0], {}),
      [
        read(paths[1], {}),
        read(paths[2], {}),
        read(paths[4], {}),
        read(paths[6], {}),
        read(paths[7], {}),
        read(paths[8], {}),
        read(paths[13], {}),
        read(paths[14], {}),
        read(paths[15], {}),
        peteZora,
      ],
      [
        ...basePeople,
        ...(peteZora.proposedPeople || []).filter(
          (p) => !basePeople.some((existing) => existing.id === p.id),
        ),
      ],
    );
    const audit = {
      results: {
        ...read(paths[3], { results: {} }).results,
        ...read(paths[5], { results: {} }).results,
      },
    };
    const verifiedCredits = read(paths[12], { records: {} }).records;
    for (const record of merged.records) {
      const additions = (verifiedCredits[record.id] || []).filter((c) =>
        merged.people.some((p) => p.id === c.personId),
      );
      if (!additions.length) continue;
      record.personIds = [
        ...new Set([
          ...(record.personIds || []),
          ...additions.map((c) => c.personId),
        ]),
      ];
      record.credits = [
        ...(record.credits || []),
        ...additions.filter(
          (c) =>
            !record.credits?.some(
              (old) => old.personId === c.personId && old.role === c.role,
            ),
        ),
      ];
    }
    const musicMetadata = read(paths[9], { records: {} }).records;
    const audioAnalysis = read(paths[10], { records: {} }).records;
    const revenue = read(paths[11], { records: {} }).records;
    const royalties = new Map();
    for (const event of read(paths[16], { verified: [] }).verified) {
      const key = `${event.chainId}-${event.contract.toLowerCase()}-${event.tokenId}`;
      if (!royalties.has(key)) royalties.set(key, []);
      royalties.get(key).push(event);
    }
    merged.records = merged.records.map((r) => ({
      ...r,
      audioAnalysis: audioAnalysis[r.id] || null,
      royaltyPayments:
        royalties.get(
          `${r.chainId}-${r.contract.toLowerCase()}-${r.tokenId}`,
        ) || [],
      revenue:
        revenue[`${r.chainId}-${r.contract.toLowerCase()}-${r.tokenId}`] ||
        null,
      musicMetadata:
        musicMetadata[r.id]?.status === "read"
          ? musicMetadata[r.id]
          : r.musicMetadata || null,
      kind: mediaKind(r, merged.evidence[r.id]),
      playback: audit.results[r.id]
        ? {
            status: audit.results[r.id].status,
            checkedAt: audit.results[r.id].checkedAt,
            workingURL: audit.results[r.id].attempts?.find(
              (a) => a.status === "played",
            )?.url,
          }
        : r.playback || null,
    }));
    const releaseDates = read(paths[17], {});
    for (const record of merged.records)
      record.releaseDate = releaseDateForRecord(record, releaseDates);
    // Keep discovery evidence on disk; only music belongs in the listening catalog.
    merged.records = merged.records.filter((r) => r.kind !== "artwork");
    cached = merged;
    signature = next;
    return cached;
  };
}
