const zero = "0x0000000000000000000000000000000000000000";
export function catalogHolders(record, snapshot) {
  if (record.platform !== "Catalog" || ![1, 8453].includes(record.chainId))
    return null;
  const same = (row) =>
    row.contract === record.contract.toLowerCase() &&
    row.tokenId === String(record.tokenId);
  let items = [];
  const purchaseSnapshot = () => {
    const purchases = snapshot.basePurchases.filter(same),
      recipients = new Map();
    if (!purchases.length) return null;
    for (const purchase of purchases)
      recipients.set(
        purchase.recipient,
        (recipients.get(purchase.recipient) || 0n) + BigInt(purchase.amount),
      );
    return {
      status: "indexed",
      scope: "catalog-purchases",
      snapshotDate: snapshot.snapshotDate,
      checkedAt: snapshot.snapshotDate,
      source: snapshot.source,
      nextCursor: null,
      purchases,
      items: [...recipients].map(([address, amount]) => ({
        address,
        balance: amount.toString(),
      })),
    };
  };
  if (record.chainId === 1) {
    const owner = snapshot.ethereumOwners.find(same)?.address;
    if (!owner) return null;
    if (owner !== zero) items = [{ address: owner, balance: "1" }];
  } else {
    const balances = new Map();
    const transfers = snapshot.baseTransfers.filter(same);
    if (!transfers.some((transfer) => transfer.from === zero))
      return purchaseSnapshot();
    for (const transfer of transfers) {
      const amount = BigInt(transfer.amount);
      if (amount < 0n) return null;
      if (transfer.from !== zero)
        balances.set(
          transfer.from,
          (balances.get(transfer.from) || 0n) - amount,
        );
      if (transfer.to !== zero)
        balances.set(transfer.to, (balances.get(transfer.to) || 0n) + amount);
    }
    // An incomplete export must not manufacture holders by ignoring missing debits.
    if ([...balances.values()].some((amount) => amount < 0n))
      return purchaseSnapshot();
    items = [...balances]
      .filter(([, amount]) => amount > 0n)
      .map(([address, amount]) => ({ address, balance: amount.toString() }));
  }
  return {
    status: "indexed",
    scope: "catalog-snapshot",
    snapshotDate: snapshot.snapshotDate,
    checkedAt: snapshot.snapshotDate,
    source: snapshot.source,
    items,
    nextCursor: null,
    purchases:
      record.chainId === 8453 ? snapshot.basePurchases.filter(same) : [],
  };
}
