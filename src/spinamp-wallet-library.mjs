import { hasTokenIdentity } from "./asset-capabilities.mjs";
import { getAddress } from "viem";
const SOURCE = "https://api.spinamp.xyz/v3/graphql";
const CHAINS = {
  ethereum: 1,
  optimism: 10,
  polygon: 137,
  base: 8453,
  zora: 7777777,
};
const fail = (condition, message) => {
  if (!condition) throw Error(message);
};
const numeric = (v) => typeof v === "string" && /^\d{1,78}$/.test(v);
const key = (chain, contract, token) =>
  `${chain}:${contract.toLowerCase()}:${BigInt(token)}`;
const query = `query($address:String!,$after:Cursor){allNfts(first:20,after:$after,orderBy:CREATED_AT_TIME_DESC,filter:{nftsCollectorsByNftId:{some:{addressId:{equalTo:$address},amount:{greaterThan:0}}}}){totalCount pageInfo{hasNextPage endCursor}nodes{id chainId contractAddress tokenId tokenUri nftFactoryByNftFactoryId{standard} nftsCollectorsByNftId(condition:{addressId:$address},first:5){totalCount pageInfo{hasNextPage}nodes{addressId amount nftId}} nftsProcessedTracksByNftId(first:5){totalCount pageInfo{hasNextPage}nodes{processedTrackByProcessedTrackId{id}}}}}}`;
function pageCursor(address, after) {
  return Buffer.from(
    JSON.stringify({ v: 1, address: address.toLowerCase(), after }),
  ).toString("base64url");
}
function parseCursor(address, cursor) {
  if (!cursor) return null;
  fail(
    typeof cursor === "string" &&
      cursor.length <= 3000 &&
      /^[A-Za-z0-9_-]+$/.test(cursor),
    "Invalid cursor",
  );
  let d;
  try {
    d = JSON.parse(Buffer.from(cursor, "base64url").toString());
  } catch {
    throw Error("Invalid cursor");
  }
  fail(
    d.v === 1 &&
      d.address === address.toLowerCase() &&
      Object.keys(d).sort().join(",") === "address,after,v" &&
      typeof d.after === "string" &&
      d.after.length <= 1800 &&
      /^[A-Za-z0-9+/=_-]+$/.test(d.after),
    "Invalid cursor",
  );
  return d.after;
}
export function normalizeSpinampWalletPage(
  data,
  address,
  records,
  registry = new Map(),
) {
  fail(!data.errors && data.data?.allNfts, "Spinamp query failed");
  const c = data.data.allNfts;
  fail(
    Array.isArray(c.nodes) &&
      c.nodes.length <= 20 &&
      Number.isSafeInteger(c.totalCount) &&
      c.totalCount >= c.nodes.length &&
      typeof c.pageInfo?.hasNextPage === "boolean",
    "Invalid collection page",
  );
  if (c.pageInfo.hasNextPage)
    fail(
      typeof c.pageInfo.endCursor === "string" &&
        /^[A-Za-z0-9+/=_-]{1,1800}$/.test(c.pageInfo.endCursor),
      "Invalid next cursor",
    );
  const exact = new Map(),
    byTrack = new Map(),
    byContract = new Map();
  for (const r of records) {
    if (
      !hasTokenIdentity(r) ||
      !Object.values(CHAINS).includes(r.chainId) ||
      !/^0x[0-9a-f]{40}$/i.test(r.contract || "") ||
      r.standard === "ERC20"
    )
      continue;
    const collection = `${r.chainId}:${r.contract.toLowerCase()}`;
    byContract.set(collection, [...(byContract.get(collection) || []), r]);
    if (numeric(r.tokenId))
      exact.set(key(r.chainId, r.contract, r.tokenId), [
        ...(exact.get(key(r.chainId, r.contract, r.tokenId)) || []),
        r,
      ]);
    if (r.spinampTrackId)
      byTrack.set(r.spinampTrackId, [
        ...(byTrack.get(r.spinampTrackId) || []),
        r,
      ]);
  }
  const items = [],
    seen = new Set();
  let unmatchedNfts = 0,
    unsupportedNfts = 0,
    incompleteTrackRelations = 0;
  for (const n of c.nodes) {
    fail(
      n && typeof n.id === "string" && !seen.has(n.id),
      "Duplicate/missing NFT",
    );
    seen.add(n.id);
    const owners = n.nftsCollectorsByNftId;
    fail(
      Array.isArray(owners?.nodes) &&
        owners.totalCount === owners.nodes.length &&
        owners.pageInfo?.hasNextPage === false,
      "Incomplete owner evidence",
    );
    const own = owners.nodes.filter(
      (h) => h.addressId?.toLowerCase() === address.toLowerCase(),
    );
    fail(
      own.length === 1 &&
        own[0].nftId === n.id &&
        Number.isSafeInteger(own[0].amount) &&
        own[0].amount > 0,
      "Wrong wallet or invalid balance",
    );
    const chainId = CHAINS[n.chainId],
      standard = n.nftFactoryByNftFactoryId?.standard?.toUpperCase();
    if (!chainId || !["ERC721", "ERC1155"].includes(standard)) {
      unsupportedNfts++;
      continue;
    }
    fail(
      /^0x[0-9a-f]{40}$/i.test(n.contractAddress || "") && numeric(n.tokenId),
      "Invalid NFT identity",
    );
    fail(
      n.id === `${n.chainId}/${n.contractAddress}/${n.tokenId}` ||
        (chainId === 1 && n.id === `${n.contractAddress}/${n.tokenId}`),
      "Mismatched NFT identity",
    );
    if (standard === "ERC721")
      fail(own[0].amount === 1, "Invalid ERC721 balance");
    const relations = n.nftsProcessedTracksByNftId;
    fail(
      Array.isArray(relations?.nodes) &&
        relations.nodes.length <= 5 &&
        Number.isSafeInteger(relations.totalCount) &&
        relations.totalCount >= relations.nodes.length &&
        typeof relations.pageInfo?.hasNextPage === "boolean",
      "Invalid track relations",
    );
    if (relations.pageInfo.hasNextPage) incompleteTrackRelations++;
    else
      fail(
        relations.totalCount === relations.nodes.length,
        "Incomplete track relations",
      );
    const matches = new Map();
    const contract = n.contractAddress.toLowerCase();
    for (const t of relations.nodes) {
      fail(
        typeof t?.processedTrackByProcessedTrackId?.id === "string",
        "Invalid track identity",
      );
      for (const r of byTrack.get(t.processedTrackByProcessedTrackId.id) || [])
        if (r.chainId === chainId && r.contract.toLowerCase() === contract)
          matches.set(r.id, r);
    }
    for (const r of exact.get(key(chainId, contract, n.tokenId)) || [])
      matches.set(r.id, r);
    const collection = `${chainId}:${contract}`,
      candidates = byContract.get(collection) || [];
    if (!matches.size && registry.has(collection) && candidates.length === 1)
      matches.set(candidates[0].id, candidates[0]);
    if (!matches.size && BigInt(n.tokenId) >> 128n > 0n)
      for (const r of candidates)
        if (
          r.factoryVersion === 0 &&
          String(r.legacyEditionId) === (BigInt(n.tokenId) >> 128n).toString()
        )
          matches.set(r.id, r);
    if (!matches.size) unmatchedNfts++;
    for (const r of matches.values())
      items.push({
        recordId: r.id,
        chainId,
        contract,
        tokenId: n.tokenId,
        balance: String(own[0].amount),
        standard,
        nftId: n.id,
        sharedAsset: matches.size > 1,
        matchType:
          r.spinampTrackId &&
          relations.nodes.some(
            (t) => t.processedTrackByProcessedTrackId.id === r.spinampTrackId,
          )
            ? "indexed-track-relation"
            : "token-or-verified-release",
      });
  }
  return {
    status: "indexed",
    address: address.toLowerCase(),
    scope: "spinamp-wallet-index",
    indexFreshness: "unknown",
    onchainVerified: false,
    source: SOURCE,
    checkedAt: new Date().toISOString(),
    items,
    loadedNfts: c.nodes.length,
    totalIndexedNfts: c.totalCount,
    unmatchedNfts,
    unsupportedNfts,
    incompleteTrackRelations,
    nextCursor: c.pageInfo.hasNextPage
      ? pageCursor(address, c.pageInfo.endCursor)
      : null,
    message:
      "Spinamp indexed balances and explicit recording matches. Index freshness is unknown; this is not an independently verified current wallet census. Multiple recordings may belong to one NFT.",
  };
}

export async function readSpinampWalletPage(
  address,
  cursor,
  records,
  registry,
  fetcher = fetch,
) {
  try {
    fail(/^0x[0-9a-f]{40}$/i.test(address || ""), "Invalid wallet");
    const checksum = getAddress(address.toLowerCase()),
      after = parseCursor(address, cursor);
    const r = await fetcher(SOURCE, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables: { address: checksum, after } }),
      signal: AbortSignal.timeout(12000),
    });
    fail(r.ok, "Spinamp request failed");
    const raw = await r.text();
    fail(raw.length <= 2000000, "Spinamp response too large");
    const result = normalizeSpinampWalletPage(
      JSON.parse(raw),
      address,
      records,
      registry,
    );
    fail(
      !after ||
        !result.nextCursor ||
        parseCursor(address, result.nextCursor) !== after,
      "Repeated collection cursor",
    );
    return result;
  } catch (e) {
    return {
      status: "unavailable",
      address,
      scope: "spinamp-wallet-index",
      items: [],
      retryable: true,
      message:
        e.message === "Invalid cursor"
          ? e.message
          : "Spinamp’s collection index could not be read. Retry; this does not mean the wallet has no music NFTs.",
    };
  }
}

export function createSpinampWalletReader(fetcher = fetch, now = Date.now) {
  const cache = new Map(),
    pending = new Map();
  let lastRecords,
    lastRegistry,
    generation = 0;
  return async (address, cursor, records, registry) => {
    if (records !== lastRecords || registry !== lastRegistry) {
      cache.clear();
      lastRecords = records;
      lastRegistry = registry;
      generation++;
    }
    const key = `${generation}|${String(address).toLowerCase()}|${cursor || ""}`;
    const prior = cache.get(key);
    if (prior?.expires > now()) return prior.value;
    if (pending.has(key)) return pending.get(key);
    if (pending.size >= 50)
      return {
        status: "unavailable",
        address,
        scope: "spinamp-wallet-index",
        items: [],
        retryable: true,
        message: "The collection index is busy. Retry shortly.",
      };
    const task = readSpinampWalletPage(
      address,
      cursor,
      records,
      registry,
      fetcher,
    )
      .then((value) => {
        cache.set(key, {
          value,
          expires: now() + (value.status === "indexed" ? 60000 : 10000),
        });
        if (cache.size > 200) cache.delete(cache.keys().next().value);
        return value;
      })
      .finally(() => pending.delete(key));
    pending.set(key, task);
    return task;
  };
}
