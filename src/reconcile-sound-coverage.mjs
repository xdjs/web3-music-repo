const keyOf = (chain, contract) =>
  Number.isSafeInteger(Number(chain)) &&
  Number(chain) > 0 &&
  /^0x[0-9a-f]{40}$/i.test(contract || "")
    ? `${Number(chain)}:${contract.toLowerCase()}`
    : null;

// Reconcile known factory events with exact indexed identity. This does not
// change historical RPC outcomes or establish fresh playback/ownership.
export function reconcileSoundCoverage({
  censuses,
  modern,
  fallback,
  records,
  evidence,
}) {
  const attempts = { ...modern.attempts };
  for (const [key, value] of Object.entries(fallback.attempts || {})) {
    if (
      attempts[key]?.status !== "live" &&
      ["live", "unminted"].includes(value.status)
    )
      attempts[key] = value;
  }
  const byContract = new Map();
  for (const record of records) {
    const key = keyOf(record.chainId, record.contract);
    const proof = evidence[record.id];
    if (!key || !proof?.mediaURI || !["live", "indexed"].includes(proof.status))
      continue;
    if (keyOf(proof.chainId, proof.contract) !== key) continue;
    if (
      String(proof.tokenId) !== String(record.tokenId) ||
      record.tokenId == null
    )
      continue;
    if (!byContract.has(key)) byContract.set(key, []);
    byContract
      .get(key)
      .push({
        id: record.id,
        tokenId: String(record.tokenId),
        title: record.title,
        artist: record.artist,
        platform: record.platform,
        source: proof.source || proof.metadataURL || null,
        sourceType: proof.sourceType || proof.mediaSourceType || null,
        mediaURI: proof.mediaURI,
        status: proof.status,
        onchainVerified: proof.onchainVerified === true,
        playbackVerified: proof.playbackVerified === true,
      });
  }
  const seen = new Set(),
    contracts = [];
  for (const census of censuses) {
    for (const collection of census.collections || []) {
      const key = keyOf(census.chainId, collection.contract);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const matches = byContract.get(key) || [];
      contracts.push({
        key,
        chainId: census.chainId,
        contract: collection.contract.toLowerCase(),
        factory: census.factory,
        version: census.version,
        unit: collection.unit || census.unit,
        toBlock: census.toBlock,
        priorStatus: attempts[key]?.status || "not-attempted",
        indexedMediaPresent: matches.length > 0,
        matches,
      });
    }
  }
  const modernContracts = contracts.filter(
    (c) => c.unit === "release-contract",
  );
  const unresolved = modernContracts.filter(
    (c) => !["live", "unminted"].includes(c.priorStatus),
  );
  return {
    scope:
      "Exact chain/contract/token identity reconciliation against the recorded factory census only. Indexed media presence is not fresh chain verification, playable media, total editions, or complete Sound platform coverage.",
    totalKnownContracts: contracts.length,
    knownLegacyArtistContracts: contracts.length - modernContracts.length,
    knownModernReleaseContracts: modernContracts.length,
    modernWithIndexedMedia: modernContracts.filter((c) => c.indexedMediaPresent)
      .length,
    historicalUnresolved: unresolved.length,
    historicalUnresolvedNowIndexed: unresolved.filter(
      (c) => c.indexedMediaPresent,
    ).length,
    historicalUnresolvedWithoutIndexedMedia: unresolved.filter(
      (c) => !c.indexedMediaPresent,
    ).length,
    historicalUnmintedNowIndexed: modernContracts.filter(
      (c) => c.priorStatus === "unminted" && c.indexedMediaPresent,
    ).length,
    unresolvedContracts: unresolved,
  };
}
