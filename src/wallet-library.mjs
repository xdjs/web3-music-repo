import { unsupportedSolanaRead } from "./asset-capabilities.mjs";
const hosts = {
  1: "eth.blockscout.com",
  10: "optimism.blockscout.com",
  8453: "base.blockscout.com",
  7777777: "explorer.zora.energy",
  137: "polygon.blockscout.com",
};
export async function readWalletPage(
  address,
  chainId,
  cursor,
  records,
  registry,
  fetcher = fetch,
) {
  if (chainId === "solana") return unsupportedSolanaRead("wallet");
  try {
    if (!/^0x[0-9a-f]{40}$/i.test(address) || !hosts[chainId])
      throw Error("Invalid wallet or network");
    const u = new URL(
      `https://${hosts[chainId]}/api/v2/addresses/${address}/nft`,
    );
    u.searchParams.set("type", "ERC-721,ERC-1155");
    if (cursor) {
      if (cursor.length > 3000) throw Error("Invalid cursor");
      const d = JSON.parse(Buffer.from(cursor, "base64url"));
      for (const [k, v] of Object.entries(d)) {
        if (
          ![
            "token_id",
            "token_contract_address_hash",
            "token_contract_address",
            "token_type",
            "items_count",
            "id",
            "value",
          ].includes(k) ||
          !/^[-A-Za-z0-9_.]{1,100}$/.test(String(v))
        )
          throw Error("Invalid cursor");
        u.searchParams.set(k, String(v));
      }
    }
    const res = await fetcher(u, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw Error("Indexer HTTP " + res.status);
    const raw = await res.text();
    if (raw.length > 4000000) throw Error("Indexer response too large");
    const data = JSON.parse(
      raw.replace(/("(?:id|token_id|value)"\s*:\s*)(\d+)/g, '$1"$2"'),
    );
    if (!Array.isArray(data.items)) throw Error("Invalid indexer response");
    const items = data.items.slice(0, 50).flatMap((item) => {
      const contract = item.token?.address_hash?.toLowerCase(),
        tokenId = String(item.id),
        balance = String(item.value || "1");
      if (
        !/^0x[0-9a-f]{40}$/.test(contract || "") ||
        !/^\d{1,78}$/.test(tokenId) ||
        !/^\d{1,78}$/.test(balance) ||
        BigInt(balance) === 0n
      )
        return [];
      const candidates = records.filter(
        (r) =>
          r.standard !== "ERC20" &&
          r.chainId === chainId &&
          r.contract.toLowerCase() === contract,
      );
      let record = candidates.find(
        (r) =>
          r.tokenId === tokenId ||
          (Array.isArray(r.observedTokenIds) &&
            r.observedTokenIds.includes(tokenId)),
      );
      if (
        !record &&
        registry.has(`${chainId}:${contract}`) &&
        candidates.length === 1
      )
        record = candidates[0];
      if (!record && BigInt(tokenId) >> 128n)
        record = candidates.find(
          (r) =>
            r.factoryVersion === 0 &&
            String(r.legacyEditionId) === (BigInt(tokenId) >> 128n).toString(),
        );
      return [
        {
          contract,
          tokenId,
          balance,
          standard: item.token_type,
          recordId: record?.id || null,
          collection: String(item.token?.name || "Unknown collection").slice(
            0,
            180,
          ),
        },
      ];
    });
    return {
      status: "indexed",
      address,
      chainId,
      items,
      nextCursor: data.next_page_params
        ? Buffer.from(JSON.stringify(data.next_page_params)).toString(
            "base64url",
          )
        : null,
      checkedAt: new Date().toISOString(),
      source: u.origin + "/address/" + address,
      scope:
        "Current indexed holdings; music matches are limited to the recovered archive.",
    };
  } catch (e) {
    return {
      status: "unavailable",
      address,
      chainId,
      items: [],
      message:
        e.message === "Invalid cursor"
          ? e.message
          : "Wallet holdings could not be retrieved. Retry this network; no empty-wallet conclusion is drawn.",
    };
  }
}
