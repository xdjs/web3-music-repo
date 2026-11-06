import { readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { createCatalogLoader } from "../src/catalog-bundle.mjs";
import { storageURL } from "../src/nft-reader.mjs";
import { extractMusicMetadata } from "../src/extract-music-metadata.mjs";
const storage = (s) => {
  try {
    return storageURL(s);
  } catch {
    return null;
  }
};
export const CHAINS = {
  ethereum: 1,
  optimism: 10,
  base: 8453,
  polygon: 137,
  zora: 7777777,
};
export function contentKey(uri) {
  if (typeof uri !== "string") return null;
  const s = uri.trim();
  if (s.startsWith("ipfs://"))
    return (
      "ipfs:" +
      s
        .slice(7)
        .replace(/^ipfs\//, "")
        .split(/[?#]/)[0]
        .replace(/\/$/, "")
    );
  if (s.startsWith("ar://")) return "ar:" + s.slice(5).split(/[?#]/)[0];
  try {
    const u = new URL(s);
    if (u.pathname.startsWith("/ipfs/"))
      return "ipfs:" + u.pathname.slice(6).replace(/\/$/, "");
    if (u.hostname === "arweave.net" || u.hostname.endsWith(".arweave.net"))
      return "ar:" + u.pathname.slice(1);
    return u.href;
  } catch {
    return null;
  }
}
export function validURI(s) {
  if (typeof s !== "string" || s.length > 2048) return false;
  if (/^(ipfs|ar):\/\/[A-Za-z0-9]/.test(s)) return !s.includes("..");
  try {
    const u = new URL(s);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      !/^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(u.hostname)
    );
  } catch {
    return false;
  }
}
export function nftIdentity(n) {
  if (
    !n ||
    !CHAINS[n.chainId] ||
    !/^0x[0-9a-f]{40}$/i.test(n.contractAddress || "") ||
    !/^\d+$/.test(n.tokenId || "")
  )
    return null;
  const standard = String(
    n.nftFactoryByNftFactoryId?.standard || "",
  ).toUpperCase();
  if (!["ERC721", "ERC1155"].includes(standard)) return null;
  return {
    chainId: CHAINS[n.chainId],
    contract: n.contractAddress.toLowerCase(),
    tokenId: BigInt(n.tokenId).toString(),
    standard,
  };
}
const identityKey = (r) => `${r.chainId}:${r.contract}:${r.tokenId}`;
const artistNorm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
export function makeCandidate(t, n, platformNames, checkedAt) {
  const identity = nftIdentity(n);
  if (!identity)
    return {
      reason: n ? "unsupported-or-invalid-nft-identity" : "no-indexed-nft",
    };
  const originalMedia = n.mediaURI,
    fallback = storage(t.lossyAudioUrl)
      ? t.lossyAudioUrl
      : typeof t.lossyAudioIpfsHash === "string" &&
          /^[A-Za-z0-9]+$/.test(t.lossyAudioIpfsHash)
        ? "ipfs://" + t.lossyAudioIpfsHash
        : null,
    media = originalMedia || fallback,
    image = n.imageURI || t.lossyArtworkUrl,
    processedFallback = !originalMedia;
  if (
    !validURI(media) ||
    contentKey(media) === contentKey(image) ||
    /\.(png|jpe?g|gif|webp|svg)(?:[?#]|$)/i.test(media)
  )
    return { reason: "missing-or-artwork-only-original-media" };
  if (!storage(media)) return { reason: "unsupported-original-storage" };
  const name = t.artistByArtistId?.name;
  if (!name || !t.title) return { reason: "missing-title-or-artist" };
  if (
    typeof n.metadataArtist === "string" &&
    artistNorm(n.metadataArtist) &&
    artistNorm(n.metadataArtist) !== artistNorm(name)
  )
    return { reason: "artist-attribution-conflict" };
  if (!(Number(t.duration) > 0) && !/^audio\/|^video\//.test(n.mimeType || ""))
    return { reason: "no-indexed-audio-evidence" };
  const hash = createHash("sha256").update(t.id).digest("hex").slice(0, 20),
    id = "spinamp-" + hash,
    artistId =
      "spinamp-artist-" +
      createHash("sha256")
        .update(t.artistId || t.id)
        .digest("hex")
        .slice(0, 20);
  const kind =
    /^video\//.test(n.mimeType || "") ||
    /\.(mp4|mov|webm)(?:[?#]|$)/i.test(media)
      ? "video"
      : "audio";
  const metadataURI = validURI(n.tokenUri)
    ? n.tokenUri
    : validURI(n.tokenMetadataUri)
      ? n.tokenMetadataUri
      : null;
  return {
    record: {
      id,
      title: t.title.trim(),
      artist: name,
      artistId,
      ...identity,
      platform: platformNames[t.platformId] || "Other",
      kind,
      imageURI: validURI(image) ? image : null,
      durationSeconds: Number(t.duration) || null,
      originalRelease: validURI(t.websiteUrl) ? t.websiteUrl : null,
      discovery: "Spinamp public index",
      spinampTrackId: t.id,
      spinampArtistId: t.artistId,
      musicMetadata: {
        status: "read",
        schemaVersion: 3,
        sourceType: "spinamp-indexed-metadata",
        source: "https://api.spinamp.xyz/v3/graphql",
        onchainVerified: false,
        metadataURL: storage(metadataURI),
        ...(n.musicMetadata || extractMusicMetadata(n)),
      },
    },
    evidence: {
      status: "indexed",
      checkedAt,
      source: "https://api.spinamp.xyz/v3/graphql",
      sourceType: processedFallback
        ? "spinamp-processed-media"
        : "spinamp-index",
      mediaSourceType: processedFallback
        ? "spinamp-preserved-audio"
        : "indexed-nft-media",
      originalMediaMissing: processedFallback,
      originalMediaURI: originalMedia || null,
      chainId: identity.chainId,
      contract: identity.contract,
      tokenId: identity.tokenId,
      metadataURI,
      metadataURL: storage(metadataURI),
      mediaURI: media,
      mediaURL: storage(media),
      imageURL: storage(image),
      imageURI: validURI(image) ? image : null,
      metadataSha256: n.metadataSha256,
      metadataLocation: processedFallback
        ? "NFT identity and metadata from Spinamp index; audio preserved separately by Spinamp; original metadata media empty. Independent chain and playback verification pending"
        : "Spinamp indexed NFT metadata; independent chain and playback verification pending",
      onchainVerified: false,
      playbackVerified: false,
    },
    person: {
      id: artistId,
      name,
      kind: "Artist",
      bio: "Artist identity supplied by the Spinamp public index; not an independently verified complete discography.",
      links: [{ label: "Spinamp source", url: "https://app.spinamp.xyz/" }],
      sources: [],
      spinampArtistId: t.artistId,
      ...(t.artistByArtistId?.avatarIpfsHash &&
      storage("ipfs://" + t.artistByArtistId.avatarIpfsHash)
        ? {
            portrait: {
              src: storage("ipfs://" + t.artistByArtistId.avatarIpfsHash),
              alt: name,
              source: "https://api.spinamp.xyz/v3/graphql",
              note: "Profile image attributed by the Spinamp index",
            },
          }
        : {}),
    },
  };
}
export function buildBundle(inv, refs, existing, platformNames) {
  const byToken = new Map(
      existing.records.map((r) => [
        identityKey({ ...r, contract: r.contract.toLowerCase() }),
        r.id,
      ]),
    ),
    byMedia = new Map();
  for (const r of existing.records) {
    const m = contentKey(existing.evidence[r.id]?.mediaURI);
    if (m) byMedia.set(`${r.chainId}:${r.contract.toLowerCase()}:${m}`, r.id);
  }
  const records = [],
    evidence = {},
    people = new Map(),
    excluded = [],
    duplicates = [];
  for (const t of inv.records) {
    if (!Object.hasOwn(refs.references, t.id)) continue;
    const n = refs.references[t.id],
      c = makeCandidate(t, n, platformNames, refs.updatedAt);
    if (c.reason) {
      excluded.push({ id: t.id, reason: c.reason });
      continue;
    }
    const r = c.record,
      mediaKey = `${r.chainId}:${r.contract}:${contentKey(c.evidence.mediaURI)}`;
    const match = byToken.get(identityKey(r)) || byMedia.get(mediaKey);
    if (match) {
      duplicates.push({ id: t.id, existingId: match });
      continue;
    }
    records.push(r);
    evidence[r.id] = c.evidence;
    people.set(c.person.id, c.person);
    byToken.set(identityKey(r), r.id);
    byMedia.set(mediaKey, r.id);
  }
  return {
    bundle: {
      source: inv.source,
      checkedAt: refs.updatedAt,
      scope:
        "NFT-linked Spinamp index additions. Chain identity and media are indexer assertions; not independently verified playback or complete platform coverage.",
      records,
      evidence,
      proposedPeople: [...people.values()],
    },
    audit: {
      inventoryCount: inv.records.length,
      relationsChecked: Object.keys(refs.references).length,
      relationScanComplete: refs.complete,
      added: records.length,
      processedMediaFallbackCount: records.filter(
        (r) => evidence[r.id].originalMediaMissing,
      ).length,
      duplicateCount: duplicates.length,
      excludedCount: excluded.length,
      excludedReasons: Object.fromEntries(
        [...new Set(excluded.map((x) => x.reason))].map((k) => [
          k,
          excluded.filter((x) => x.reason === k).length,
        ]),
      ),
      chainCounts: Object.fromEntries(
        [...new Set(records.map((x) => x.chainId))].map((k) => [
          k,
          records.filter((x) => x.chainId === k).length,
        ]),
      ),
      platformCounts: Object.fromEntries(
        [...new Set(records.map((x) => x.platform))].map((k) => [
          k,
          records.filter((x) => x.platform === k).length,
        ]),
      ),
      duplicates,
      excluded,
    },
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const inv = JSON.parse(
      gunzipSync(readFileSync("data/spinamp/inventory.json.gz")),
    ),
    refs = JSON.parse(
      gunzipSync(readFileSync("data/spinamp/nft-references.json.gz")),
    ),
    schema = JSON.parse(readFileSync("data/spinamp/schema-and-counts.json"));
  if (existsSync("data/spinamp/artists.json.gz")) {
    const artists = new Map(
      JSON.parse(
        gunzipSync(readFileSync("data/spinamp/artists.json.gz")),
      ).artists.map((a) => [a.id, a]),
    );
    for (const track of inv.records) {
      const artist = artists.get(track.artistId);
      if (artist)
        track.artistByArtistId = {
          ...track.artistByArtistId,
          avatarIpfsHash: artist.avatarIpfsHash,
        };
    }
  }
  const names = Object.fromEntries(
    schema.body.data.allPlatforms.nodes.map((p) => [p.id, p.name]),
  );
  names.sound = "Sound";
  names.catalog = "Catalog";
  names["mint-songs"] = "Mint Songs";
  names.mintsongs = "Mint Songs";
  const { bundle, audit } = buildBundle(
    inv,
    refs,
    (() => {
      const baseline = createCatalogLoader()();
      return {
        ...baseline,
        records: baseline.records.filter((r) => !r.id.startsWith("spinamp-")),
      };
    })(),
    names,
  );
  const text = JSON.stringify(bundle);
  writeFileSync("data/spinamp/recovered-media.json.tmp", text + "\n");
  renameSync(
    "data/spinamp/recovered-media.json.tmp",
    "data/spinamp/recovered-media.json",
  );
  writeFileSync(
    "data/spinamp/import-audit.json.gz",
    gzipSync(JSON.stringify(audit)),
  );
  const summary = {
    ...audit,
    duplicates: undefined,
    excluded: undefined,
    bundleBytes: Buffer.byteLength(text),
    bundleGzipBytes: gzipSync(text).length,
    checkedAt: refs.updatedAt,
  };
  writeFileSync(
    "data/spinamp/import-summary.json",
    JSON.stringify(summary, null, 2) + "\n",
  );
  console.log(JSON.stringify(summary, null, 2));
}
