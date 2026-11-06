import { createHash } from "node:crypto";
import { indexRecord, presentRecord } from "./src/catalog-presentation.mjs";
import { catalogHolders } from "./src/catalog-holders.mjs";
import { readWalletPage } from "./src/wallet-library.mjs";
import { resolveWalletName } from "./src/wallet-name.mjs";
import { accountAPI } from "./src/account-api.mjs";
import {
  expansionCoverage,
  catalogCoverage,
} from "./src/recovery-coverage.mjs";
import { createCatalogLoader } from "./src/catalog-bundle.mjs";
import { gzipSync } from "node:zlib";
import { createProfileReader } from "./src/collector-profiles.mjs";
import { releaseRegistry, readCollectors } from "./src/recovery-collectors.mjs";
import { existsSync } from "node:fs";
import { portraits } from "./src/portraits.js";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const loadCatalogBundle = createCatalogLoader();
let nftCatalog = loadCatalogBundle().records;
import { people, sources } from "./src/data.js";
import { readNFT, storageURL } from "./src/nft-reader.mjs";
import { readHolders } from "./src/recovery-holders.mjs";
import { readOwner } from "./src/recovery-owner.mjs";
import { recoverySummary, normalizePlaylist } from "./src/recovery-model.mjs";
const root = fileURLToPath(new URL(".", import.meta.url));
const load = async (file, fallback) => {
  try {
    return JSON.parse(await readFile(path.join(root, file), "utf8"));
  } catch {
    return fallback;
  }
};
const staticAssets = new Set(await load("data/static-assets.json", []));
const playlist = normalizePlaylist(
  await load("evidence/sound-wayback/playlist-data.json", {}),
  [
    ...(await load("data/playlist-activity-recovery.json", [])),
    ...(await load("data/playlist-track-recovery.json", [])),
  ],
);
const historicalPlaylists = await load("data/historical-playlists.json", [
  playlist,
]);
const comments = await load(
  "evidence/sound-wayback/recovered-comments.json",
  [],
);
const historicalProfiles = await load("data/historical-profiles.json", []);
const zoraComments = await load("data/zora-onchain-comments.json", {
  comments: [],
});
const historicalProfileByAddress = new Map(
  historicalProfiles.map((p) => [p.address.toLowerCase(), p]),
);
function commentProfile(address) {
  const profile = historicalProfileByAddress.get(address?.toLowerCase());
  return profile
    ? {
        name: profile.name,
        avatar: profile.localAvatar,
        source: profile.source,
        capturedAt: profile.capturedAt,
      }
    : null;
}
const artistPresentation = await load("data/artist-presentation.json", {});
const historicalArtists = await load("data/historical-artists.json", []);
const profileReader = createProfileReader(historicalProfiles);
const registry = releaseRegistry(
  await Promise.all(
    [
      "sound-v1-1-index.json",
      "sound-v1-10-index.json",
      "sound-v2-index.json",
      "sound-v2-10-index.json",
      "census/1-1.json",
      "census/2-1.json",
      "census/1-10.json",
      "census/2-10.json",
    ].map((file) => load("data/" + file, {})),
  ),
);
const collectorCache = new Map();
const catalogHolderSnapshot = await load(
  "data/catalog/holder-history.json",
  null,
);
function archivedArtist(person, records) {
  const handles = new Set(
    records
      .filter((r) => r.artistId === person.id && r.originalRelease)
      .map((r) => {
        try {
          return new URL(r.originalRelease).pathname.split("/")[1];
        } catch {
          return "";
        }
      }),
  );
  return historicalArtists.find(
    (a) =>
      handles.has(a.soundHandle) &&
      a.name.trim().toLowerCase() === person.name.trim().toLowerCase(),
  );
}
function archivedArtistPortrait(person, records) {
  const creators = new Set(
    records
      .filter((r) => r.artistId === person.id)
      .map((r) => r.creator?.toLowerCase())
      .filter(Boolean),
  );
  const artist = archivedArtist(person, records);
  const match = historicalProfiles.find(
    (p) =>
      p.localAvatar &&
      ((creators.has(p.address) &&
        p.name.trim().toLowerCase() === person.name.trim().toLowerCase()) ||
        p.address === artist?.address),
  );
  return match
    ? {
        src: match.localAvatar,
        alt: person.name,
        credit: `Sound profile captured ${match.capturedAt}; matched through archived artist identity or release creator wallet`,
        source: match.source,
        retrieved: match.avatarRetrievedAt,
      }
    : null;
}
function artistPortrait(id) {
  const p = portraits[id];
  if (!p || p.kind === "work artwork") return null;
  const candidates = [
    id === "jamee-cornelia" ? "/people/jamee-cornelia-source.jpg" : null,
    p.file ? `/media/${p.file}-480.webp` : null,
    `/people/${id}-160.webp`,
    `/people/${id}-640.webp`,
  ].filter(Boolean);
  const src = candidates.find(
    (src) =>
      staticAssets.has(src) || existsSync(path.join(root, "public", src)),
  );
  return src
    ? {
        src,
        alt: p.alt,
        credit: p.credit,
        source: p.evidence || p.url,
        retrieved: p.retrieved,
      }
    : null;
}
const pending = new Map();
const json = (res, data, status = 200) => {
  res.writeHead(status, {
    ...(res.wantsGzip
      ? { "Content-Encoding": "gzip", Vary: "Accept-Encoding" }
      : {}),
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  const serialized = JSON.stringify(data);
  res.end(res.wantsGzip ? gzipSync(serialized) : serialized);
};
const indexResponses = new WeakMap();
function publicIndex(req, res, bundle, build) {
  let cached = indexResponses.get(bundle);
  if (!cached) {
    const body = JSON.stringify(build());
    cached = {
      body,
      gzip: gzipSync(body),
      etag:
        'W/"' +
        createHash("sha256").update(body).digest("hex").slice(0, 24) +
        '"',
    };
    indexResponses.set(bundle, cached);
  }
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=0, must-revalidate",
    Vary: "Accept-Encoding",
    ETag: cached.etag,
  };
  if (
    req.headers["if-none-match"]
      ?.split(",")
      .map((value) => value.trim())
      .includes(cached.etag)
  ) {
    res.writeHead(304, headers);
    return res.end();
  }
  const body = res.wantsGzip ? cached.gzip : cached.body;
  res.writeHead(200, {
    ...headers,
    ...(res.wantsGzip ? { "Content-Encoding": "gzip" } : {}),
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(req.method === "HEAD" ? undefined : body);
}
export function buildCatalogPayload(bundle, isIndex = false) {
  const records = bundle.records;
  const snapshot = bundle.evidence;
  const recordsByArtist = new Map();
  for (const record of records) {
    const artistRecords = recordsByArtist.get(record.artistId) || [];
    artistRecords.push(record);
    recordsByArtist.set(record.artistId, artistRecords);
  }
  return {
    records: records.map((r) =>
      (isIndex ? indexRecord : presentRecord)(r, snapshot[r.id]),
    ),
    people: bundle.people.map((p) => ({
      id: p.id,
      name: p.name,
      bio: artistPresentation[p.id]?.bio || p.bio,
      role: p.role,
      kind: p.kind,
      portrait:
        artistPortrait(p.id) ||
        archivedArtistPortrait(p, recordsByArtist.get(p.id) || []) ||
        p.portrait ||
        null,
      banner: artistPresentation[p.id] || null,
      aliases: p.aliases || [],
      links: [
        ...(p.links || []),
        ...(archivedArtist(p, recordsByArtist.get(p.id) || [])?.links || []),
      ].filter((l) => /^https:\/\//.test(l.url)),
      sources: (p.sources || [])
        .map((id) => sources[id])
        .filter(Boolean)
        .map((s) => ({
          title: s.title,
          url: s.url,
          date: s.date,
          kind: s.kind,
        })),
    })),
    summary: recoverySummary(records, snapshot),
  };
}
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".json": "application/json",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
};
export async function handler(req, res) {
  try {
    const url = new URL(req.url, "http://localhost");
    const bundle = loadCatalogBundle();
    nftCatalog = bundle.records;
    res.wantsGzip = /gzip/.test(req.headers["accept-encoding"] || "");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    if (await accountAPI(req, res, url, json)) return;
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405);
      return res.end();
    }
    if (url.pathname === "/api/wallet/resolve") {
      const result = await resolveWalletName(url.searchParams.get("name"));
      const status = {
        resolved: 200,
        invalid: 400,
        "not-found": 404,
        unavailable: 503,
      };
      return json(res, result, status[result.status]);
    }
    if (url.pathname.startsWith("/api/wallet/")) {
      const value = await readWalletPage(
        url.pathname.slice(12),
        Number(url.searchParams.get("chainId")),
        url.searchParams.get("cursor"),
        nftCatalog,
        registry,
      );
      return json(res, value, value.status === "indexed" ? 200 : 503);
    }
    if (url.pathname.startsWith("/api/record/")) {
      let id;
      try {
        id = decodeURIComponent(url.pathname.slice(12));
      } catch {
        return json(res, { error: "Invalid recording ID" }, 400);
      }
      const record = nftCatalog.find((record) => record.id === id);
      return record
        ? json(res, { record: presentRecord(record, bundle.evidence[id]) })
        : json(res, { error: "Recording not found" }, 404);
    }
    if (url.pathname === "/api/catalog") {
      const isIndex = url.searchParams.get("view") === "index";
      return isIndex
        ? publicIndex(req, res, bundle, () => buildCatalogPayload(bundle, true))
        : json(res, buildCatalogPayload(bundle));
    }
    if (url.pathname === "/api/coverage")
      return json(res, {
        additionalChains: await Promise.all(
          [8453, 137].map(async (chainId) => {
            const d = await load(`data/census/2-${chainId}-rpc.json`, {});
            return {
              chainId,
              verifiedFactory: true,
              complete: d.complete === true,
              contracts: d.collections?.length || 0,
              reason:
                "Historical event retrieval limited by public RPC and indexer access; collection coverage is not established.",
            };
          }),
        ),
        catalogWorks: catalogCoverage(
          await load("data/catalog/token-inventory.json", {}),
          await load("data/catalog/archived-media.json", {}),
          await load("data/catalog/live-verification.json", {}),
        ),
        soundMetadataGaps: await load("data/sound-metadata-gaps.json", {}).then(
          (d) =>
            Object.values(d.results || {}).reduce((counts, r) => {
              counts[r.status] = (counts[r.status] || 0) + 1;
              return counts;
            }, {}),
        ),
        manifest: await load("data/census/manifest.json", {}),
        legacy: await load("data/legacy-expanded.json", {}).then((d) => ({
          artists: Object.values(d.artists || {}).map((a) => ({
            name: a.name,
            contract: a.contract,
            editionCount: a.editionCount,
            complete: a.complete,
            error: a.error,
            recovered: a.editions?.filter((e) => e.status === "live").length,
            unminted: a.editions?.filter((e) => e.status === "unminted").length,
          })),
          records: d.records?.length || 0,
        })),
        expansion: expansionCoverage(
          await load("data/sound-expanded.json", {}),
          await load("data/sound-fallback.json", {}),
        ),
        playback: await load("data/playback-audit.json", {}).then((d) => ({
          scope: d.scope,
          checked: Object.keys(d.results || {}).length,
          played: Object.values(d.results || {}).filter(
            (r) => r.status === "played",
          ).length,
          unavailable: Object.values(d.results || {}).filter(
            (r) => r.status !== "played",
          ).length,
          updatedAt: d.updatedAt,
        })),
      });
    if (url.pathname === "/api/archive")
      return json(res, {
        playlist,
        playlists: historicalPlaylists,
        comments: comments.map((comment) => ({
          ...comment,
          profile: commentProfile(comment.ownerAddressAtCapture),
        })),
        onchainComments: zoraComments.comments
          .filter(
            (comment) =>
              comment.verification ===
              "official-minter-and-matching-mint-receipt",
          )
          .map((comment) => ({
            ...comment,
            profile: commentProfile(comment.recipient),
          })),
        onchainCommentRecovery: {
          scope: zoraComments.scope,
          checkedAt: zoraComments.checkedAt,
          scans: zoraComments.scans,
          deploymentSource: zoraComments.deploymentSource,
        },
        capturedAt: "2023-05-01T06:11:19Z",
      });
    if (url.pathname.startsWith("/api/collector/")) {
      const address = url.pathname.slice(15);
      if (!/^0x[0-9a-f]{40}$/i.test(address))
        return json(res, { error: "Invalid wallet" }, 400);
      const identity = await profileReader(address);
      const held = [];
      for (const [key, entry] of collectorCache) {
        if (
          entry.value.scope === "release" &&
          entry.value.items?.some(
            (h) => h.address.toLowerCase() === address.toLowerCase(),
          )
        ) {
          const record = nftCatalog.find((r) => r.id === key.split("|")[0]);
          if (record && !held.some((r) => r.id === record.id))
            held.push({
              id: record.id,
              title: record.title,
              artist: record.artist,
              chainId: record.chainId,
              checkedAt: entry.value.checkedAt,
            });
        }
      }
      return json(res, {
        ...identity,
        observedHoldings: held,
        comments: comments.filter(
          (c) =>
            c.ownerAddressAtCapture?.toLowerCase() === address.toLowerCase(),
        ),
      });
    }
    if (url.pathname.startsWith("/api/collectors/")) {
      const record = nftCatalog.find(
        (r) => r.id === decodeURIComponent(url.pathname.slice(16)),
      );
      if (!record) return json(res, { error: "Unknown recording" }, 404);
      const cursor = url.searchParams.get("cursor");
      const key = record.id + "|" + (cursor || "");
      const cached = collectorCache.get(key);
      if (cached && cached.expires > Date.now()) return json(res, cached.value);
      const v =
        (catalogHolderSnapshot &&
          catalogHolders(record, catalogHolderSnapshot)) ||
        (await readCollectors(record, cursor, registry));
      v.items = v.items?.map((h) => ({
        ...h,
        archived:
          historicalProfiles.find(
            (p) => p.address.toLowerCase() === h.address.toLowerCase(),
          ) || null,
      }));
      if (v.status === "indexed") {
        collectorCache.set(key, { value: v, expires: Date.now() + 60000 });
        if (collectorCache.size > 500)
          collectorCache.delete(collectorCache.keys().next().value);
      }
      return json(res, v, v.status === "unavailable" ? 503 : 200);
    }
    if (url.pathname.startsWith("/api/holders/")) {
      const record = nftCatalog.find(
        (r) => r.id === decodeURIComponent(url.pathname.slice(13)),
      );
      if (!record) return json(res, { error: "Unknown recording" }, 404);
      const v = await readHolders(record, url.searchParams.get("cursor"));
      return json(res, v, v.status === "unavailable" ? 503 : 200);
    }
    if (
      url.pathname.startsWith("/api/recover/") ||
      url.pathname.startsWith("/api/owner/")
    ) {
      const id = decodeURIComponent(url.pathname.split("/").pop());
      const record = nftCatalog.find((r) => r.id === id);
      if (!record) return json(res, { error: "Unknown recording" }, 404);
      const isOwner = url.pathname.includes("/owner/");
      const key = (isOwner ? "owner:" : "recover:") + id;
      if (!pending.has(key))
        pending.set(
          key,
          (isOwner ? readOwner(record) : readNFT(record)).finally(() =>
            pending.delete(key),
          ),
        );
      const value = await pending.get(key);
      return json(res, value, value.status === "unavailable" ? 503 : 200);
    }
    if (url.pathname === "/api/manifest") {
      const snapshot = bundle.evidence;
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="music-nerd-recovery.json"',
      );
      return json(res, {
        generatedAt: new Date().toISOString(),
        scope:
          "Recovered NFT Era catalog and Sound factory releases; not a complete Sound archive",
        records: nftCatalog.map((r) => ({
          id: r.id,
          artist: r.artist,
          title: r.title,
          chainId: r.chainId,
          contract: r.contract,
          tokenId: r.tokenId,
          evidence: snapshot[r.id] || null,
        })),
      });
    }
    let file =
      url.pathname === "/"
        ? "archive.html"
        : url.pathname.startsWith("/src/")
          ? url.pathname.slice(1)
          : "public" + url.pathname;
    const absolute = path.resolve(root, file);
    if (!absolute.startsWith(root) || file.includes("..")) {
      res.writeHead(404);
      return res.end();
    }
    let body;
    try {
      body = await readFile(absolute);
    } catch {
      res.writeHead(404);
      return res.end("Not found");
    }
    let type = types[path.extname(file)];
    if (file.endsWith(".img")) {
      type =
        body.subarray(0, 4).toString() === "RIFF"
          ? "image/webp"
          : body[0] === 137
            ? "image/png"
            : body.subarray(0, 3).toString() === "GIF"
              ? "image/gif"
              : "image/jpeg";
    }
    res.writeHead(200, {
      "Content-Type": type || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch (e) {
    json(res, { error: "Request could not be completed" }, 500);
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
  http
    .createServer(handler)
    .listen(Number(process.env.PORT || 4190), "127.0.0.1", () =>
      console.log(
        "Music Nerd Archive http://127.0.0.1:" + (process.env.PORT || 4190),
      ),
    );
