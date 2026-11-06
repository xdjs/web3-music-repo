import {
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { createCatalogLoader } from "../src/catalog-bundle.mjs";
import { storageURL } from "../src/nft-reader.mjs";
import { extractMusicMetadata } from "../src/extract-music-metadata.mjs";
import {
  isSolanaAsset,
  isSolanaMint,
  solanaMintIdentity,
  assetIdentityKey,
  assetCollectionKey,
} from "../src/solana-identity.mjs";
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
  if (/^ipfs:\/\/[A-Za-z0-9]/.test(s) || /^ar:\/\/[A-Za-z0-9_-]/.test(s))
    return !s.includes("..");
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
  if (n?.chainId === "solana") return solanaMintIdentity(n);
  if (
    !n ||
    !Object.hasOwn(CHAINS, n.chainId) ||
    (typeof n.tokenId === "number" && !Number.isSafeInteger(n.tokenId)) ||
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
const identityKey = assetIdentityKey;
const artistNorm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
export function makeCandidate(t, n, platformNames, checkedAt) {
  if (t.platformId === "pods")
    return { reason: "podcast-platform-outside-music-scope" };
  const identity = nftIdentity(n);
  if (!identity)
    return {
      reason: n ? "unsupported-or-invalid-nft-identity" : "no-indexed-nft",
    };
  const solana = isSolanaAsset(identity);
  if (
    solana &&
    (t.platformId !== "nina" ||
      t.id !== `solana/${identity.mint}` ||
      t.platformInternalId !== identity.mint)
  )
    return { reason: "unverified-solana-platform-mint-mapping" };
  const cleanURI = (value) => (typeof value === "string" ? value.trim() : null);
  const originalMedia = cleanURI(n.mediaURI),
    image = cleanURI(n.imageURI) || cleanURI(t.lossyArtworkUrl),
    availableFallbacks = [
      cleanURI(t.lossyAudioUrl),
      typeof t.lossyAudioIpfsHash === "string" &&
      /^[A-Za-z0-9]+$/.test(t.lossyAudioIpfsHash.trim())
        ? "ipfs://" + t.lossyAudioIpfsHash.trim()
        : null,
    ],
    fallback = availableFallbacks.find(
      (value) => validURI(value) && storage(value),
    ),
    originalMediaUnavailableReason = !originalMedia
      ? "missing-original-media"
      : !validURI(originalMedia)
        ? "invalid-original-media-uri"
        : !storage(originalMedia)
          ? "unsupported-original-storage"
          : null,
    processedFallback = !!originalMediaUnavailableReason,
    media = processedFallback ? fallback : originalMedia;
  if (
    originalMedia &&
    (contentKey(originalMedia) === contentKey(image) ||
      /\.(png|jpe?g|gif|webp|svg)(?:[?#]|$)/i.test(originalMedia) ||
      /^image\//.test(n.mimeType || ""))
  )
    return { reason: "missing-or-artwork-only-original-media" };
  if (
    !media &&
    originalMediaUnavailableReason === "unsupported-original-storage"
  )
    return { reason: "unsupported-original-storage" };
  if (
    !validURI(media) ||
    contentKey(media) === contentKey(image) ||
    /\.(png|jpe?g|gif|webp|svg)(?:[?#]|$)/i.test(media)
  )
    return { reason: "missing-or-artwork-only-original-media" };
  if (!storage(media)) return { reason: "unsupported-original-storage" };
  const name = t.artistByArtistId?.name;
  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof t.title !== "string" ||
    !t.title.trim()
  )
    return { reason: "missing-title-or-artist" };
  const knownPete =
    String(t.artistId || "").toLowerCase() ===
    "ethereum/0x625307de45bd25ad6bf6cc7391a308fc84067cf7";
  const peteAlias =
    knownPete &&
    ["peterango", "p3t3rango"].includes(artistNorm(n.metadataArtist)) &&
    ["peterango", "p3t3rango"].includes(artistNorm(name));
  if (
    typeof n.metadataArtist === "string" &&
    artistNorm(n.metadataArtist) &&
    artistNorm(n.metadataArtist) !== artistNorm(name) &&
    !peteAlias
  )
    return { reason: "artist-attribution-conflict" };
  const ninaAudioReference =
    solana &&
    originalMedia &&
    contentKey(originalMedia) === contentKey(t.lossyAudioUrl) &&
    validURI(t.lossyAudioUrl) &&
    storage(t.lossyAudioUrl);
  if (
    !ninaAudioReference &&
    !(Number.isFinite(Number(t.duration)) && Number(t.duration) > 0) &&
    !/^audio\/|^video\//.test(n.mimeType || "")
  )
    return { reason: "no-indexed-audio-evidence" };
  const hash = createHash("sha256").update(t.id).digest("hex").slice(0, 20),
    id = "spinamp-" + hash,
    artistId = knownPete
      ? "pete-rango"
      : "spinamp-artist-" +
        createHash("sha256")
          .update(t.artistId || t.id)
          .digest("hex")
          .slice(0, 20);
  const kind =
    !processedFallback &&
    (/^video\//.test(n.mimeType || "") ||
      /\.(mp4|mov|webm)(?:[?#]|$)/i.test(media))
      ? "video"
      : "audio";
  const metadataURI = validURI(n.tokenUri)
    ? n.tokenUri
    : validURI(n.tokenMetadataUri)
      ? n.tokenMetadataUri
      : null;
  const createdAt =
    typeof n.createdAtTime === "string" &&
    /^\d{4}-\d{2}-\d{2}T/.test(n.createdAtTime)
      ? Date.parse(n.createdAtTime)
      : NaN;
  const block = /^\d+$/.test(String(n.createdAtBlockNumber ?? ""))
    ? Number(n.createdAtBlockNumber)
    : NaN;
  const indexedNftCreation =
    Number.isFinite(createdAt) &&
    createdAt >= Date.UTC(2009, 0, 1) &&
    createdAt <= Date.now() + 86400000
      ? {
          date: new Date(createdAt).toISOString(),
          ...(Number.isSafeInteger(block) && block >= 0
            ? { blockNumber: block }
            : {}),
          source: "https://api.spinamp.xyz/v3/graphql",
          onchainVerified: false,
        }
      : null;
  let ninaReleaseAddress = null;
  if (solana && validURI(t.websiteUrl)) {
    const u = new URL(t.websiteUrl),
      address = u.pathname.replace(/^\/|\/$/g, "");
    if (
      ["nina.market", "ninaprotocol.com"].includes(u.hostname) &&
      isSolanaMint(address)
    )
      ninaReleaseAddress = address;
  }
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
      ...(indexedNftCreation
        ? solana
          ? {
              indexedSourceDate: {
                date: indexedNftCreation.date,
                source: indexedNftCreation.source,
                onchainVerified: false,
                kind: "indexed-metadata-date",
              },
            }
          : { indexedNftCreation }
        : {}),
      ...(solana ? { ninaReleaseAddress, mediaTypeProvisional: true } : {}),
      musicMetadata: {
        status: "read",
        schemaVersion: n.musicMetadataSchemaVersion || 3,
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
      originalMediaMissing: !originalMedia,
      ...(processedFallback ? { originalMediaUnavailableReason } : {}),
      originalMediaURI: originalMedia || null,
      ...(solana
        ? {
            chainId: "solana",
            mint: identity.mint,
            standard: identity.standard,
            mediaEvidence: {
              basis:
                "Nina indexed NFT media matches its processed audio reference",
              durationKnown: Number(t.duration) > 0,
              indexedMimeType: n.mimeType || null,
            },
            mediaKindProvisional: true,
          }
        : {
            chainId: identity.chainId,
            contract: identity.contract,
            tokenId: identity.tokenId,
          }),
      metadataURI,
      metadataURL: storage(metadataURI),
      mediaURI: media,
      mediaURL: storage(media),
      imageURL: storage(image),
      imageURI: validURI(image) ? image : null,
      metadataSha256: n.metadataSha256,
      metadataLocation: processedFallback
        ? "NFT identity and metadata from Spinamp index; audio preserved separately by Spinamp; original media is absent or not usable through supported storage. Independent chain and playback verification pending"
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
              originalURI: "ipfs://" + t.artistByArtistId.avatarIpfsHash,
              checkedAt,
              note: "Public profile image attributed by the Spinamp artist index",
            },
          }
        : {}),
    },
  };
}
export function applyMediaObservation(record, evidence, observation) {
  const playback = observation?.playback;
  const key = contentKey(evidence.mediaURI);
  const video =
    Number.isInteger(playback?.videoWidth) &&
    playback.videoWidth > 0 &&
    Number.isInteger(playback?.videoHeight) &&
    playback.videoHeight > 0;
  if (
    observation?.id !== record.id ||
    observation.status !== "played" ||
    !key ||
    contentKey(observation.mediaURI) !== key ||
    !(playback?.currentTime > 0) ||
    !(
      playback.audioDecodedBytes > 0 ||
      (video && playback.videoDecodedBytes > 0)
    )
  )
    return false;
  if (
    (observation.chainId !== undefined &&
      observation.chainId !== record.chainId) ||
    (observation.contract &&
      observation.contract.toLowerCase() !== record.contract?.toLowerCase()) ||
    (observation.mint && observation.mint !== record.mint) ||
    (observation.tokenId !== undefined &&
      String(observation.tokenId) !== String(record.tokenId))
  )
    return false;
  record.kind = video ? "video" : "audio";
  if (isSolanaAsset(record)) {
    record.mediaTypeProvisional = false;
    evidence.mediaKindProvisional = false;
  }
  evidence.mediaKindSource =
    "Observed native media startup decode for this exact content reference";
  evidence.mediaKindEvidence =
    observation.evidenceFile ||
    "data/spinamp/expanded-sample-verification.json";
  if (observation.checkedAt)
    evidence.mediaKindCheckedAt = observation.checkedAt;
  return true;
}
export function applyNinaPlaybackObservation(
  record,
  evidence,
  observation,
  track,
) {
  if (!isSolanaAsset(record))
    return applyMediaObservation(record, evidence, observation);
  if (applyMediaObservation(record, evidence, observation)) return true;
  const fallback = observation?.preservedFallback;
  const expectedURI =
    typeof track?.lossyAudioIpfsHash === "string"
      ? "ipfs://" + track.lossyAudioIpfsHash
      : null;
  if (
    observation?.id !== record.id ||
    observation.chainId !== "solana" ||
    observation.mint !== record.mint ||
    observation.status !== "unavailable" ||
    contentKey(observation.mediaURI) !== contentKey(evidence.mediaURI) ||
    fallback?.status !== "played" ||
    !expectedURI ||
    contentKey(fallback.mediaURI) !== contentKey(expectedURI) ||
    !storage(expectedURI)
  )
    return false;
  const testRecord = { ...record },
    testEvidence = { ...evidence, mediaURI: expectedURI };
  if (
    !applyMediaObservation(testRecord, testEvidence, {
      ...observation,
      status: "played",
      mediaURI: expectedURI,
      playback: fallback.playback,
    })
  )
    return false;
  Object.assign(record, testRecord);
  Object.assign(evidence, testEvidence, {
    originalMediaURI: evidence.originalMediaURI || evidence.mediaURI,
    originalMediaMissing: false,
    originalMediaUnavailableReason: "original-startup-timeout",
    sourceType: "spinamp-processed-media",
    mediaSourceType: "spinamp-preserved-audio",
    mediaURI: expectedURI,
    mediaURL: storage(expectedURI),
    metadataLocation:
      "Nina NFT identity and metadata from Spinamp index. Original audio did not start in the bounded browser check; playback uses a separately indexed Spinamp audio copy. Independent chain verification remains pending.",
  });
  return true;
}
export function buildBundle(
  inv,
  refs,
  existing,
  platformNames,
  playbackObservations = [],
) {
  const observed = new Map(playbackObservations.map((row) => [row.id, row]));
  const byToken = new Map(existing.records.map((r) => [identityKey(r), r.id])),
    byMedia = new Map();
  for (const r of existing.records) {
    const m = contentKey(existing.evidence[r.id]?.mediaURI);
    if (m) byMedia.set(`${assetCollectionKey(r)}:${m}`, r.id);
  }
  const records = [],
    evidence = {},
    people = new Map(),
    excluded = [],
    duplicates = [],
    unresolved = [];
  for (const t of inv.records) {
    if (!Object.hasOwn(refs.references, t.id)) {
      unresolved.push({
        id: t.id,
        reason: refs.failures?.[t.id] || "NFT relation not read",
      });
      continue;
    }
    const n = refs.references[t.id],
      c = makeCandidate(t, n, platformNames, refs.updatedAt);
    if (c.reason) {
      excluded.push({
        id: t.id,
        reason: c.reason,
        platformId: t.platformId,
        ...(n?.chainId ? { indexedChain: n.chainId } : {}),
      });
      continue;
    }
    const r = c.record,
      mediaKey = `${assetCollectionKey(r)}:${contentKey(c.evidence.mediaURI)}`;
    const match = byToken.get(identityKey(r)) || byMedia.get(mediaKey);
    if (match) {
      duplicates.push({ id: t.id, existingId: match });
      continue;
    }
    applyNinaPlaybackObservation(r, c.evidence, observed.get(r.id), t);
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
      relationCensusComplete: unresolved.length === 0,
      relationScanComplete:
        unresolved.length === 0 &&
        Object.keys(refs.failures || {}).length === 0,
      relationScope:
        "One representative NFT relation per processed track; not a census of every NFT edition/mint",
      unresolvedCount: unresolved.length,
      metadataRetryFailures: Object.keys(refs.failures || {}).filter((id) =>
        Object.hasOwn(refs.references, id),
      ).length,
      retryFailureCount: Object.keys(refs.failures || {}).length,
      relationMultiplicityMeasured: Object.keys(refs.relationCounts || {})
        .length,
      multipleRelationTracksMeasured: Object.values(
        refs.relationCounts || {},
      ).filter((n) => n > 1).length,
      added: records.length,
      processedMediaFallbackCount: records.filter(
        (r) => evidence[r.id].mediaSourceType === "spinamp-preserved-audio",
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
      nina: {
        inventory: inv.records.filter((t) => t.platformId === "nina").length,
        linked: inv.records.filter(
          (t) => t.platformId === "nina" && refs.references[t.id],
        ).length,
        added: records.filter(isSolanaAsset).length,
        artistIds: new Set(records.filter(isSolanaAsset).map((r) => r.artistId))
          .size,
        unknownDuration: records.filter(
          (r) => isSolanaAsset(r) && !r.durationSeconds,
        ).length,
        unknownIndexedMimeType: records.filter(
          (r) =>
            isSolanaAsset(r) && !evidence[r.id].mediaEvidence.indexedMimeType,
        ).length,
        observedMediaKind: records.filter(
          (r) => isSolanaAsset(r) && r.mediaTypeProvisional === false,
        ).length,
        excludedReasons: Object.fromEntries(
          [
            ...new Set(
              excluded
                .filter((x) => x.platformId === "nina")
                .map((x) => x.reason),
            ),
          ].map((reason) => [
            reason,
            excluded.filter(
              (x) => x.platformId === "nina" && x.reason === reason,
            ).length,
          ]),
        ),
      },
      indexedSourceDates: records.filter((r) => r.indexedSourceDate?.date)
        .length,
      unknownDurationCount: records.filter((r) => !r.durationSeconds).length,
      indexedCreationDates: records.filter((r) => r.indexedNftCreation?.date)
        .length,
      originalMediaUnavailableReasons: Object.fromEntries(
        [
          ...new Set(
            records
              .map((r) => evidence[r.id].originalMediaUnavailableReason)
              .filter(Boolean),
          ),
        ].map((reason) => [
          reason,
          records.filter(
            (r) => evidence[r.id].originalMediaUnavailableReason === reason,
          ).length,
        ]),
      ),
      unsupportedChainCounts: Object.fromEntries(
        [
          ...new Set(
            excluded
              .filter((x) => x.reason === "unsupported-or-invalid-nft-identity")
              .map((x) => x.indexedChain || "unknown"),
          ),
        ].map((chain) => [
          chain,
          excluded.filter(
            (x) =>
              x.reason === "unsupported-or-invalid-nft-identity" &&
              (x.indexedChain || "unknown") === chain,
          ).length,
        ]),
      ),
      portraits: [...people.values()].filter((p) => p.portrait?.src).length,
      peteWalletMatchedRecords: records.filter(
        (r) => r.artistId === "pete-rango",
      ).length,
      duplicates,
      excluded,
      unresolved,
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
    [
      "data/spinamp/expanded-sample-verification.json",
      "data/spinamp/video-kind-verification.json",
      "data/spinamp/nina-playback-verification.json",
    ].flatMap((evidenceFile) => {
      if (!existsSync(evidenceFile)) return [];
      const report = JSON.parse(readFileSync(evidenceFile));
      return (report.results || []).map((row) => ({
        ...row,
        evidenceFile,
        checkedAt: report.checkedAt,
      }));
    }),
  );
  const outputDir = process.env.SPINAMP_OUTPUT_DIR || "data/spinamp";
  mkdirSync(outputDir, { recursive: true });
  const text = JSON.stringify(bundle);
  writeFileSync(outputDir + "/recovered-media.json.tmp", text + "\n");
  renameSync(
    outputDir + "/recovered-media.json.tmp",
    outputDir + "/recovered-media.json",
  );
  writeFileSync(
    outputDir + "/import-audit.json.gz",
    gzipSync(JSON.stringify(audit)),
  );
  const summary = {
    ...audit,
    duplicates: undefined,
    excluded: undefined,
    unresolved: undefined,
    bundleBytes: Buffer.byteLength(text),
    bundleGzipBytes: gzipSync(text).length,
    checkedAt: refs.updatedAt,
  };
  writeFileSync(
    outputDir + "/import-summary.json",
    JSON.stringify(summary, null, 2) + "\n",
  );
  console.log(JSON.stringify(summary, null, 2));
}
