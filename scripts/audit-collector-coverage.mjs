import { readFileSync, writeFileSync } from "node:fs";
import { createCatalogLoader } from "../src/catalog-bundle.mjs";
import { releaseRegistry } from "../src/recovery-collectors.mjs";
import { catalogHolders } from "../src/catalog-holders.mjs";
import { holderMediaKey } from "../src/recovery-holders.mjs";
const read = (path, fallback) => {
  try {
    return JSON.parse(readFileSync(path));
  } catch {
    return fallback;
  }
};
const b = createCatalogLoader()(),
  registry = releaseRegistry(
    [
      "sound-v1-1-index.json",
      "sound-v1-10-index.json",
      "sound-v2-index.json",
      "sound-v2-10-index.json",
      "census/1-1.json",
      "census/2-1.json",
      "census/1-10.json",
      "census/2-10.json",
    ].map((p) => read("data/" + p, {})),
  ),
  history = read("data/catalog/holder-history.json", null);
const supported = [1, 10, 8453, 7777777];
function audit(records, evidence) {
  const groups = {},
    affected = [];
  for (const r of records) {
    const e = evidence[r.id],
      media =
        e?.sourceType === "spinamp-processed-media"
          ? e.originalMediaURI
          : e?.mediaURI;
    let route;
    if (r.standard === "ERC20") route = "coin-unsupported";
    else if (history && catalogHolders(r, history))
      route = "catalog-historical-snapshot";
    else if (r.factoryVersion === 0 && r.legacyEditionId)
      route = "legacy-sound-filtered";
    else if (r.standard === "ERC1155")
      route = supported.includes(r.chainId)
        ? "new-token-specific-erc1155"
        : "erc1155-index-unavailable-chain";
    else if (registry.has(`${r.chainId}:${r.contract.toLowerCase()}`))
      route = "verified-sound-release";
    else if (
      holderMediaKey(media) &&
      supported.includes(r.chainId) &&
      (r.standard === undefined || r.standard === "ERC721")
    )
      route = "new-media-matched-erc721";
    else route = "selected-token-owner-only";
    const key = `${route}|${r.platform}|${r.chainId}`;
    groups[key] = (groups[key] || 0) + 1;
    if (route.startsWith("new-"))
      affected.push({
        id: r.id,
        title: r.title,
        artist: r.artist,
        platform: r.platform,
        chainId: r.chainId,
        standard: r.standard || "ERC721-assumed-legacy",
        route,
      });
  }
  return {
    records: records.length,
    routeCounts: Object.fromEntries(
      [...new Set(Object.keys(groups).map((k) => k.split("|")[0]))].map(
        (route) => [
          route,
          Object.entries(groups)
            .filter(([k]) => k.startsWith(route + "|"))
            .reduce((n, [, v]) => n + v, 0),
        ],
      ),
    ),
    platformChainRoutes: Object.entries(groups).map(([key, count]) => {
      const [route, platform, chainId] = key.split("|");
      return { route, platform, chainId: Number(chainId), count };
    }),
    affected,
  };
}
const result = {
  checkedAt: new Date().toISOString(),
  scope:
    "Static routing audit across loaded catalog, not a claim every remote holder endpoint is available or every NFT holder is recovered. Media matching checks exact immutable content, never shared titles/artwork. Catalog historical snapshots retain precedence.",
  current: audit(b.records, b.evidence),
};
const candidate = read("data/spinamp/candidate/recovered-media.json", null);
if (candidate) {
  const records = [
    ...b.records.filter((r) => !r.id.startsWith("spinamp-")),
    ...candidate.records,
  ];
  result.expandedCandidate = audit(records, {
    ...b.evidence,
    ...candidate.evidence,
  });
}
writeFileSync(
  "data/collector-coverage-audit.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    current: result.current.routeCounts,
    expanded: result.expandedCandidate?.routeCounts,
  }),
);
