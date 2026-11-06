const hosts = {
  1: "eth.blockscout.com",
  10: "optimism.blockscout.com",
  8453: "base.blockscout.com",
  7777777: "explorer.zora.energy",
};
export async function readHolders(record, cursor, fetcher = fetch) {
  try {
    const host = hosts[record.chainId];
    if (!host || !/^0x[0-9a-f]{40}$/i.test(record.contract)) throw Error();
    const url = new URL(
      `https://${host}/api/v2/tokens/${record.contract}/holders`,
    );
    if (cursor) {
      const c = JSON.parse(Buffer.from(cursor, "base64url").toString());
      for (const [k, v] of Object.entries(c)) {
        if (
          !["address_hash", "value", "items_count", "token_id"].includes(k) ||
          !/^([0-9]+|0x[0-9a-f]{40})$/i.test(String(v))
        )
          throw Error();
        url.searchParams.set(k, String(v));
      }
    }
    const res = await fetcher(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw Error();
    const d = await res.json();
    if (!Array.isArray(d.items)) throw Error();
    return {
      status: "indexed",
      source: url.href,
      checkedAt: new Date().toISOString(),
      scope: "contract",
      items: d.items
        .slice(0, 50)
        .filter((x) => /^0x[0-9a-f]{40}$/i.test(x.address?.hash))
        .map((x) => ({
          address: x.address.hash,
          ens: x.address.ens_domain_name || null,
          balance: String(x.value),
          tokenId: x.token_id ? String(x.token_id) : null,
        })),
      nextCursor: d.next_page_params
        ? Buffer.from(JSON.stringify(d.next_page_params)).toString("base64url")
        : null,
    };
  } catch {
    return {
      status: "unavailable",
      message:
        "The holder index is unavailable. Direct ownerOf reads remain independent of this index.",
    };
  }
}
