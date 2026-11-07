const SOURCE = "https://api.spinamp.xyz/v3/graphql";
const CHAINS = {
  ethereum: 1,
  optimism: 10,
  polygon: 137,
  base: 8453,
  zora: 7777777,
};
const address = (v) => typeof v === "string" && /^0x[0-9a-f]{40}$/i.test(v);
const token = (v) => typeof v === "string" && /^(0|[1-9][0-9]*)$/.test(v);
const requireThat = (ok, reason) => {
  if (!ok) throw new Error(`Invalid Spinamp collector snapshot: ${reason}`);
};
export function isImmutableSnapshotMetadata(value) {
  return (
    typeof value === "string" &&
    value.length <= 2048 &&
    (/^ipfs:\/\/[A-Za-z0-9]+(?:\/[^\s?#]*)?$/.test(value) ||
      /^(?:ar:\/\/|https:\/\/arweave\.net\/)[A-Za-z0-9_-]{43}(?:\/[^\s?#]*)?$/.test(
        value,
      ))
  );
}
function complete(connection) {
  return (
    connection &&
    Number.isSafeInteger(connection.totalCount) &&
    connection.totalCount >= 0 &&
    Array.isArray(connection.nodes) &&
    connection.nodes.length === connection.totalCount &&
    connection.pageInfo?.hasNextPage === false
  );
}

// Public index evidence only. This is not a fresh chain balance or mint-history reader.
export function normalizeSpinampCollectorSnapshot(evidence) {
  const {
    recordId,
    trackId,
    chainId,
    contract,
    metadataURI,
    relations,
    owners,
  } = evidence;
  requireThat(
    typeof recordId === "string" &&
      typeof trackId === "string" &&
      address(contract) &&
      isImmutableSnapshotMetadata(metadataURI),
    "release identity",
  );
  requireThat(
    relations?.source === SOURCE &&
      owners?.source === SOURCE &&
      !relations.body?.errors,
    "relation source/errors",
  );
  requireThat(
    relations.query?.includes(`processedTrackId:${JSON.stringify(trackId)}`),
    "exact queried track",
  );
  const connection = relations.body?.data?.relations;
  requireThat(
    complete(connection) &&
      connection.totalCount > 0 &&
      connection.totalCount <= 300,
    "incomplete/bounded relation census",
  );
  const nfts = new Map(),
    tokenIds = new Set();
  function identity(n) {
    requireThat(
      n &&
        CHAINS[n.chainId] === chainId &&
        n.contractAddress?.toLowerCase() === contract.toLowerCase() &&
        token(n.tokenId) &&
        n.tokenUri === metadataURI,
      "unrelated NFT identity or metadata",
    );
    requireThat(
      n.id === `${n.chainId}/${n.contractAddress}/${n.tokenId}`,
      "NFT identifier mismatch",
    );
  }
  for (const row of connection.nodes) {
    const n = row?.nftByNftId;
    identity(n);
    requireThat(
      n.nftFactoryByNftFactoryId?.standard?.toLowerCase() === "erc721" &&
        !nfts.has(n.id) &&
        !tokenIds.has(n.tokenId),
      "duplicate or unsupported edition",
    );
    nfts.set(n.id, n);
    tokenIds.add(n.tokenId);
  }
  const seen = new Set(),
    wallets = new Map(),
    checked = [relations.checkedAt];
  requireThat(Array.isArray(owners.responses), "owner responses");
  for (const response of owners.responses) {
    requireThat(
      response.source === SOURCE &&
        !response.body?.errors &&
        response.body?.data,
      "owner source/errors",
    );
    checked.push(response.checkedAt);
    for (const n of Object.values(response.body.data)) {
      identity(n);
      requireThat(
        nfts.has(n.id) && !seen.has(n.id),
        "extra/duplicate ownership response",
      );
      requireThat(
        response.query?.includes(`nftById(id:${JSON.stringify(n.id)})`),
        "ownership query identity",
      );
      seen.add(n.id);
      const c = n.nftsCollectorsByNftId;
      requireThat(complete(c), "incomplete owner pagination");
      let supply = 0;
      const addresses = new Set();
      for (const h of c.nodes) {
        requireThat(
          h.nftId === n.id &&
            address(h.addressId) &&
            Number.isSafeInteger(h.amount) &&
            h.amount >= 0 &&
            h.amount <= 1,
          "invalid owner row",
        );
        const a = h.addressId.toLowerCase();
        requireThat(!addresses.has(a), "duplicate owner row");
        addresses.add(a);
        if (h.amount === 0 || a === `0x${"0".repeat(40)}`) continue;
        supply += h.amount;
        const item = wallets.get(a) || {
          address: a,
          balance: "0",
          tokenIds: [],
        };
        item.balance = String(BigInt(item.balance) + BigInt(h.amount));
        item.tokenIds.push(n.tokenId);
        wallets.set(a, item);
      }
      requireThat(supply <= 1, "conflicting ERC721 owners");
    }
  }
  requireThat(seen.size === nfts.size, "missing ownership response");
  requireThat(
    checked.every(
      (t) => typeof t === "string" && Number.isFinite(Date.parse(t)),
    ),
    "query timestamps",
  );
  return {
    status: "indexed",
    scope: "spinamp-release-snapshot",
    source: SOURCE,
    recordId,
    trackId,
    chainId,
    contract: contract.toLowerCase(),
    metadataURI,
    checkedAt: checked.sort().at(-1),
    indexFreshness: "unknown",
    onchainVerified: false,
    completeForIndexedTrack: true,
    mappedTokenCount: nfts.size,
    items: [...wallets.values()].sort((a, b) =>
      a.address.localeCompare(b.address),
    ),
    nextCursor: null,
  };
}

// Runtime reader revalidates the stored evidence, then binds it to this exact recording.
export function readSpinampCollectorSnapshot(
  record,
  snapshots,
  recordEvidence,
) {
  const evidence = snapshots?.records?.[record?.id];
  if (
    !evidence ||
    evidence.recordId !== record.id ||
    record.standard !== "ERC721" ||
    record.spinampTrackId !== evidence.trackId ||
    record.chainId !== evidence.chainId ||
    record.contract?.toLowerCase() !== evidence.contract?.toLowerCase() ||
    recordEvidence?.metadataURI !== evidence.metadataURI
  )
    return null;
  try {
    return normalizeSpinampCollectorSnapshot(evidence);
  } catch {
    return null;
  }
}
