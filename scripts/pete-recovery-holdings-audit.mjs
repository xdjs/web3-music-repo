import { readFileSync, writeFileSync } from "node:fs";
import { createCatalogLoader } from "../src/catalog-bundle.mjs";
const file = "data/pete-recovery/opensea-holdings.json",
  d = JSON.parse(readFileSync(file));
const b = createCatalogLoader()();
const chainIds = {
  ethereum: 1,
  optimism: 10,
  base: 8453,
  polygon: 137,
  zora: 7777777,
};
const rows = d.items.map((x) => {
  const chainId = chainIds[x.chain.identifier];
  const exact = b.records.filter(
    (r) =>
      r.chainId === chainId &&
      r.contract.toLowerCase() === x.contractAddress.toLowerCase() &&
      r.tokenId === x.tokenId,
  );
  const contract = b.records.filter(
    (r) =>
      r.chainId === chainId &&
      r.contract.toLowerCase() === x.contractAddress.toLowerCase(),
  );
  return {
    name: x.name,
    chainId,
    chain: x.chain.identifier,
    contract: x.contractAddress,
    tokenId: x.tokenId,
    standard: x.standard,
    collection: x.collection.name,
    description: x.description,
    metadataURI: x.tokenUri,
    indexedAnimationURL: x.animationUrl,
    indexedImageURL: x.imageUrl,
    collectionOwner: x.collection.owner?.address || null,
    source: `https://opensea.io/assets/${x.chain.identifier}/${x.contractAddress}/${x.tokenId}`,
    exactCatalogIds: exact.map((r) => r.id),
    sameContractCatalogIds: contract.map((r) => r.id),
    potentialMedia: /\.(wav|mp3|m4a|mp4|mov|webm)(?:$|\?)/i.test(
      x.animationUrl || "",
    )
      ? "indexer_audio_or_video_candidate"
      : "not_established",
    peteMention: /pete rango|p3t3rango/i.test(
      x.name + " " + x.description + " " + x.collection.name,
    ),
  };
});
writeFileSync(
  "data/pete-recovery/opensea-discovery-audit.json",
  JSON.stringify(
    {
      checkedAt: d.checkedAt,
      source: d.source,
      wallet: d.wallet,
      scope:
        "Public visible holdings only. Holdings and name mentions are discovery signals, not artist credits or playable-media verification.",
      displayedItemCount: 413,
      retrievedUniqueTokens: rows.length,
      paginationExhausted: d.complete,
      counterMismatch: 413 - rows.length,
      chainCounts: Object.fromEntries(
        [...new Set(rows.map((x) => x.chain))].map((c) => [
          c,
          rows.filter((x) => x.chain === c).length,
        ]),
      ),
      counts: {
        exactCatalogToken: rows.filter((x) => x.exactCatalogIds.length).length,
        sameContractInCatalog: rows.filter(
          (x) => x.sameContractCatalogIds.length,
        ).length,
        missingContractMediaCandidates: rows.filter(
          (x) =>
            !x.sameContractCatalogIds.length &&
            x.potentialMedia === "indexer_audio_or_video_candidate",
        ).length,
      },
      records: rows,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  rows
    .filter(
      (x) =>
        !x.sameContractCatalogIds.length &&
        x.potentialMedia === "indexer_audio_or_video_candidate",
    )
    .map((x) => ({
      name: x.name,
      chain: x.chain,
      contract: x.contract,
      token: x.tokenId,
      peteMention: x.peteMention,
    })),
);
