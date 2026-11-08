import { hasTokenIdentity } from "./asset-capabilities.mjs";
import { catalogHolders } from "./catalog-holders.mjs";
import { readSpinampCollectorSnapshot } from "./spinamp-collectors.mjs";

// Historical/index snapshots remain separate from current wallet scans.
export function collectorSnapshotHoldings(
  address,
  records,
  evidence,
  catalogSnapshot,
  spinampSnapshots,
) {
  if (!/^0x[0-9a-f]{40}$/i.test(address || "")) return [];
  address = address.toLowerCase();
  const exact = new Map(),
    byId = new Map(records.map((r) => [r.id, r])),
    result = [];
  for (const r of records)
    if (r.platform === "Catalog" && r.contract && [1, 8453].includes(r.chainId))
      exact.set(`${r.chainId}:${r.contract.toLowerCase()}:${r.tokenId}`, r);
  const candidates = new Map();
  for (const row of catalogSnapshot?.ethereumOwners || [])
    if (row.address?.toLowerCase() === address) {
      const r = exact.get(`1:${row.contract?.toLowerCase()}:${row.tokenId}`);
      if (r) candidates.set(r.id, r);
    }
  for (const row of [
    ...(catalogSnapshot?.baseTransfers || []),
    ...(catalogSnapshot?.basePurchases || []),
  ])
    if (
      [row.from, row.to, row.recipient].some(
        (a) => a?.toLowerCase() === address,
      )
    ) {
      const r = exact.get(`8453:${row.contract?.toLowerCase()}:${row.tokenId}`);
      if (r) candidates.set(r.id, r);
    }
  const append = (r, s) => {
    const h = s?.items?.find((h) => h.address?.toLowerCase() === address);
    if (!h || !/^\d+$/.test(h.balance || "") || BigInt(h.balance) === 0n)
      return;
    result.push({
      id: r.id,
      recordId: r.id,
      title: r.title,
      artist: r.artist,
      chainId: r.chainId,
      scope: s.scope,
      balance: h.balance,
      source: s.source,
      checkedAt: s.checkedAt,
      snapshotDate: s.snapshotDate || null,
      indexFreshness: s.indexFreshness || "historical",
      onchainVerified: false,
    });
  };
  for (const r of candidates.values())
    append(r, catalogHolders(r, catalogSnapshot));
  for (const id of Object.keys(spinampSnapshots?.records || {})) {
    const r = byId.get(id);
    if (r && hasTokenIdentity(r))
      append(
        r,
        readSpinampCollectorSnapshot(r, spinampSnapshots, evidence[id]),
      );
  }
  return result;
}
