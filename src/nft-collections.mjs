import { storageURL } from "./nft-reader.mjs";
export async function readCollection(record, cursor, fetcher = fetch) {
  try {
    if (cursor && !/^\d{1,78}$/.test(cursor)) throw Error("Invalid cursor");
    const host = {
      1: "eth.blockscout.com",
      10: "optimism.blockscout.com",
      8453: "base.blockscout.com",
      7777777: "explorer.zora.energy",
    }[record.chainId];
    if (!host) throw Error("Unsupported chain");
    const url = `https://${host}/api/v2/tokens/${record.contract}/instances${cursor ? "?unique_token=" + cursor : ""}`;
    const res = await fetcher(url, {
      headers: {
        "User-Agent": "MusicNerdEra/0.1 (read-only collection explorer)",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw Error("Indexer unavailable");
    const text = await res.text();
    if (text.length > 2097152) throw Error("Response too large");
    // Preserve uint256 pagination values without passing them through a JS number.
    const data = JSON.parse(
      text.replace(/("unique_token"\s*:\s*)(\d+)/g, '$1"$2"'),
    );
    const items = (data.items || []).slice(0, 50).flatMap((item) => {
      const tokenId = String(item.id);
      if (!/^\d{1,78}$/.test(tokenId)) return [];
      let imageURL = null;
      try {
        imageURL = storageURL(item.metadata?.image);
      } catch {}
      return [
        {
          tokenId,
          title: String(item.metadata?.name || "Edition " + tokenId).slice(
            0,
            180,
          ),
          imageURL,
        },
      ];
    });
    return {
      status: "indexed",
      items,
      nextCursor: data.next_page_params?.unique_token
        ? String(data.next_page_params.unique_token)
        : null,
      contract: record.contract,
    };
  } catch {
    return {
      status: "unavailable",
      items: [],
      message:
        "The collection index is unavailable. The featured edition can still be read directly from Ethereum.",
    };
  }
}
