import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createCatalogLoader } from "../src/catalog-bundle.mjs";
const inv = JSON.parse(
    gunzipSync(readFileSync("data/spinamp/inventory.json.gz")),
  ),
  b = createCatalogLoader()();
const chainIds = {
  ethereum: 1,
  optimism: 10,
  base: 8453,
  polygon: 137,
  zora: 7777777,
  arbitrum: 42161,
};
function identity(id) {
  const a = id.split("/");
  if (a.length === 3 && chainIds[a[0]] && /^0x[0-9a-f]{40}$/i.test(a[1]))
    return {
      chain: a[0],
      chainId: chainIds[a[0]],
      contract: a[1].toLowerCase(),
      tokenId: /^\d+$/.test(a[2]) ? a[2] : null,
      trackSuffix: a[2],
    };
  return null;
}
function content(uri) {
  if (!uri) return null;
  if (uri.startsWith("ipfs://"))
    return "ipfs:" + uri.slice(7).split("?")[0].replace(/\/$/, "");
  if (uri.startsWith("ar://"))
    return "ar:" + uri.slice(5).split("?")[0].replace(/\/$/, "");
  try {
    const u = new URL(uri);
    if (u.pathname.startsWith("/ipfs/"))
      return "ipfs:" + u.pathname.slice(6).replace(/\/$/, "");
    if (u.hostname === "arweave.net" || u.hostname.endsWith(".arweave.net"))
      return "ar:" + u.pathname.slice(1).replace(/\/$/, "");
    return u.href;
  } catch {
    return null;
  }
}
const tokens = new Map(),
  contracts = new Map(),
  media = new Map();
for (const r of b.records) {
  const c = `${r.chainId}:${r.contract.toLowerCase()}`;
  contracts.set(c, [...(contracts.get(c) || []), r.id]);
  tokens.set(c + ":" + r.tokenId, r.id);
  const m = content(b.evidence[r.id]?.mediaURI);
  if (m) media.set(m, [...(media.get(m) || []), r.id]);
}
const rows = inv.records.map((r) => {
  const i = identity(r.id),
    c = i ? `${i.chainId}:${i.contract}` : null;
  const matchedMedia = [
    ...new Set(
      [
        r.lossyAudioUrl,
        r.lossyAudioIpfsHash && "ipfs://" + r.lossyAudioIpfsHash,
      ].flatMap((u) => media.get(content(u)) || []),
    ),
  ];
  return {
    id: r.id,
    title: r.title,
    artist: r.artistByArtistId?.name || null,
    platformId: r.platformId,
    identity: i,
    source: r.websiteUrl,
    audioURL: r.lossyAudioUrl,
    audioIpfsHash: r.lossyAudioIpfsHash,
    duration: r.duration,
    exactSelectedToken: i?.tokenId
      ? tokens.get(c + ":" + i.tokenId) || null
      : null,
    sameContractCount: c ? (contracts.get(c) || []).length : 0,
    sameContractSample: c ? (contracts.get(c) || []).slice(0, 3) : [],
    sameMedia: matchedMedia,
  };
});
const countBy = (fn) =>
  Object.fromEntries(
    [...new Set(rows.map(fn))]
      .sort()
      .map((k) => [k, rows.filter((r) => fn(r) === k).length]),
  );
const platformCounts = countBy((r) => r.platformId || "unknown");
const platformCoverage = Object.fromEntries(
  Object.keys(platformCounts).map((p) => {
    const a = rows.filter((r) => r.platformId === p);
    return [
      p,
      {
        total: a.length,
        exactSelectedToken: a.filter((r) => r.exactSelectedToken).length,
        sameContract: a.filter((r) => r.sameContractCount).length,
        sameMedia: a.filter((r) => r.sameMedia.length).length,
        noContractOrMediaMatch: a.filter(
          (r) => !r.sameContractCount && !r.sameMedia.length,
        ).length,
      },
    ];
  }),
);
const audit = {
  checkedAt: new Date().toISOString(),
  source: inv.source,
  inventory: {
    records: inv.records.length,
    uniqueIds: new Set(inv.records.map((x) => x.id)).size,
    completePagination: inv.complete,
    pages: inv.pages.length,
  },
  catalogRecords: b.records.length,
  platformCounts,
  chainPrefixCounts: countBy((r) => r.id.split("/")[0]),
  platformCoverage,
  matchCounts: {
    parseableEVMContract: rows.filter((r) => r.identity).length,
    decimalTokenSuffix: rows.filter((r) => r.identity?.tokenId).length,
    exactSelectedToken: rows.filter((r) => r.exactSelectedToken).length,
    sameContract: rows.filter((r) => r.sameContractCount).length,
    sameMedia: rows.filter((r) => r.sameMedia.length).length,
    noContractOrMediaMatch: rows.filter(
      (r) => !r.sameContractCount && !r.sameMedia.length,
    ).length,
  },
  limits: [
    "Same-contract overlap does not prove same song for multi-track contracts.",
    "A hash/name suffix is NOT a token ID; resolve through nftsProcessedTracks before import.",
    "A processed-track entry is an indexer assertion, not independent tokenURI or playback proof.",
    "Lossy audio IPFS hashes may be Spinamp transcodes; do not label them original source audio.",
  ],
  peteCandidates: rows.filter((r) =>
    /pete rango|p3t3rango/i.test(r.artist || ""),
  ),
  baseSoundCandidates: rows
    .filter(
      (r) =>
        r.platformId === "sound" &&
        r.identity?.chainId === 8453 &&
        !r.sameContractCount,
    )
    .slice(0, 12),
  publicPlaylistRecovery: JSON.parse(
    readFileSync("data/spinamp/public-playlists.json"),
  ).playlists.map((p) => ({
    id: p.id,
    title: p.title,
    entries: p.trackIds.length,
    foundInInventory: p.trackIds.filter((id) => rows.some((r) => r.id === id))
      .length,
    exactSelectedTokenMatches: p.trackIds.filter((id) =>
      rows.some((r) => r.id === id && r.exactSelectedToken),
    ).length,
  })),
};
writeFileSync(
  "data/spinamp/coverage-audit.json",
  JSON.stringify(audit, null, 2) + "\n",
);
writeFileSync(
  "data/spinamp/identity-matches.json.gz",
  (await import("node:zlib")).gzipSync(JSON.stringify(rows)),
);
console.log(
  JSON.stringify(
    {
      inventory: audit.inventory,
      catalogRecords: audit.catalogRecords,
      matchCounts: audit.matchCounts,
      pete: audit.peteCandidates.map((r) => ({
        title: r.title,
        platform: r.platformId,
        match: r.exactSelectedToken || r.sameContractSample,
      })),
    },
    null,
    2,
  ),
);
