import { isSolanaAsset, unsupportedSolanaRead } from "./asset-capabilities.mjs";
const hosts = {
  1: "eth.blockscout.com",
  10: "optimism.blockscout.com",
  8453: "base.blockscout.com",
  7777777: "explorer.zora.energy",
};
export async function readHolders(record, cursor, fetcher = fetch) {
  if (isSolanaAsset(record)) return unsupportedSolanaRead("collectors");
  if (record.standard === "ERC20")
    return {
      status: "unsupported",
      scope: "coin",
      message:
        "Coin-holder balances are not NFT editions. A coin-holder view is not available yet.",
    };
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

// Only immutable content references may establish that sibling NFT editions
// contain the selected recording. A matching title or shared artwork is insufficient.
export function holderMediaKey(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  let path, prefix;
  if (text.startsWith("ipfs://")) {
    path = text.slice(7).replace(/^ipfs\//, "");
    prefix = "ipfs:";
  } else if (text.startsWith("ar://")) {
    path = text.slice(5);
    prefix = "ar:";
  } else {
    try {
      const url = new URL(text);
      if (url.protocol !== "https:" || url.username || url.password || url.port)
        return null;
      if (url.pathname.startsWith("/ipfs/")) {
        path = url.pathname.slice(6);
        prefix = "ipfs:";
      } else if (
        url.hostname === "arweave.net" ||
        /^[a-z0-9-]+\.arweave\.net$/.test(url.hostname)
      ) {
        path = url.pathname.slice(1);
        prefix = "ar:";
      } else return null;
    } catch {
      return null;
    }
  }
  path = path.split(/[?#]/)[0];
  try {
    path = decodeURIComponent(path);
  } catch {
    return null;
  }
  if (!path || /(?:^|\/)\.\.(?:\/|$)|\\/.test(path)) return null;
  if (prefix === "ipfs:" && !/^[A-Za-z0-9]+(?:\/.*)?$/.test(path)) return null;
  if (prefix === "ar:" && !/^[A-Za-z0-9_-]{43}(?:\/.*)?$/.test(path))
    return null;
  return prefix + path;
}
const validAddress = (value) =>
  /^0x[0-9a-f]{40}$/i.test(value || "") && !/^0x0{40}$/i.test(value);
const validToken = (value) =>
  /^(0|[1-9][0-9]{0,77})$/.test(String(value)) && BigInt(value) < 1n << 256n;
function scopedURL(record, cursor, tokenScoped) {
  const host = hosts[record.chainId];
  if (
    !host ||
    !/^0x[0-9a-f]{40}$/i.test(record.contract) ||
    !validToken(record.tokenId)
  )
    throw Error("Invalid NFT reference");
  const url = new URL(
    `https://${host}/api/v2/tokens/${record.contract}/instances${tokenScoped ? `/${record.tokenId}/holders` : ""}`,
  );
  if (cursor) {
    if (typeof cursor !== "string" || cursor.length > 2048)
      throw Error("Invalid cursor");
    const fields = JSON.parse(Buffer.from(cursor, "base64url").toString());
    if (!fields || Array.isArray(fields) || typeof fields !== "object")
      throw Error("Invalid cursor");
    const allowed = tokenScoped
      ? ["address_hash", "value", "items_count", "token_id"]
      : ["unique_token", "items_count"];
    for (const [k, v] of Object.entries(fields)) {
      if (
        !allowed.includes(k) ||
        !(k === "address_hash" ? validAddress(v) : validToken(v))
      )
        throw Error("Invalid cursor");
      url.searchParams.set(k, String(v));
    }
  }
  return url;
}
async function instancePage(record, cursor, tokenScoped, fetcher) {
  const url = scopedURL(record, cursor, tokenScoped);
  const response = await fetcher(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw Error("Holder index unavailable");
  // Token IDs and balances are uint256 values, not floating point numbers.
  const data = JSON.parse(
    (await response.text()).replace(
      /("(?:unique_token|token_id|id|value)"\s*:\s*)(\d{16,})(?=\s*[,}])/g,
      '$1"$2"',
    ),
  );
  if (!Array.isArray(data.items) || data.items.length > 50)
    throw Error("Invalid holder page");
  const nextCursor = data.next_page_params
    ? Buffer.from(JSON.stringify(data.next_page_params)).toString("base64url")
    : null;
  if (nextCursor) {
    scopedURL(record, nextCursor, tokenScoped);
    if (nextCursor === cursor) throw Error("Repeated holder page");
  }
  return { data, source: url.href, nextCursor };
}
export async function readTokenHolders(record, cursor, fetcher = fetch) {
  if (isSolanaAsset(record)) return unsupportedSolanaRead("collectors");
  if (record.standard !== "ERC1155")
    return {
      status: "unsupported",
      scope: "token-edition",
      items: [],
      message: "Token-edition holders require ERC-1155.",
    };
  try {
    const { data, source, nextCursor } = await instancePage(
      record,
      cursor,
      true,
      fetcher,
    );
    const items = [];
    for (const row of data.items) {
      if (
        row.token_id != null &&
        String(row.token_id) !== String(record.tokenId)
      )
        throw Error("Wrong token in holder page");
      if (!validAddress(row.address?.hash) || !validToken(row.value))
        throw Error("Invalid holder balance");
      if (BigInt(row.value) === 0n) continue;
      items.push({
        address: row.address.hash,
        ens: row.address.ens_domain_name || null,
        balance: String(row.value),
        tokenId: String(record.tokenId),
      });
    }
    return {
      status: "indexed",
      scope: "token-edition",
      items,
      nextCursor,
      source,
      checkedAt: new Date().toISOString(),
      tokenId: String(record.tokenId),
    };
  } catch {
    return {
      status: "unavailable",
      scope: "token-edition",
      items: [],
      message:
        "The token-specific holder index could not be read. Retry; no empty-holder conclusion is drawn.",
    };
  }
}
export async function readMediaHolders(record, cursor, fetcher = fetch) {
  if (isSolanaAsset(record)) return unsupportedSolanaRead("collectors");
  const mediaKey = holderMediaKey(record.collectorMediaURI);
  if (
    !mediaKey ||
    (record.standard !== undefined && record.standard !== "ERC721")
  )
    return { status: "unsupported", scope: "media-release", items: [] };
  try {
    const { data, source, nextCursor } = await instancePage(
        record,
        cursor,
        false,
        fetcher,
      ),
      holders = new Map();
    let unmatchedTokenCount = 0;
    for (const token of data.items) {
      if (!validToken(token.id)) throw Error("Invalid indexed token");
      const media =
        token.metadata?.animation_url ||
        token.metadata?.audio_url ||
        token.metadata?.audio ||
        token.animation_url;
      if (holderMediaKey(media) !== mediaKey) {
        unmatchedTokenCount++;
        continue;
      }
      if (!validAddress(token.owner?.hash)) {
        unmatchedTokenCount++;
        continue;
      }
      const address = token.owner.hash,
        key = address.toLowerCase();
      const holder = holders.get(key) || {
        address,
        ens: token.owner.ens_domain_name || null,
        balance: "0",
        tokenIds: [],
      };
      if (!holder.tokenIds.includes(String(token.id)))
        holder.tokenIds.push(String(token.id));
      holder.balance = String(holder.tokenIds.length);
      holders.set(key, holder);
    }
    return {
      status: "indexed",
      scope: "media-release",
      items: [...holders.values()],
      nextCursor,
      source,
      checkedAt: new Date().toISOString(),
      matchedMediaURI: record.collectorMediaURI,
      scannedTokenCount: data.items.length,
      unmatchedTokenCount,
    };
  } catch {
    return {
      status: "unavailable",
      scope: "media-release",
      items: [],
      message:
        "The recording's indexed editions could not be checked. Retry; unrelated contract holders are never attributed to this recording.",
    };
  }
}
