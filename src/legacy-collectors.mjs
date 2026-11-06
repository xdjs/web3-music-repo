import { toFunctionSelector } from "viem";
export function parseTokenPage(text) {
  return JSON.parse(
    text.replace(
      /("(?:unique_token|token_id|id)"\s*:\s*)(\d{16,})(?=\s*[,}])/g,
      '$1"$2"',
    ),
  );
}
export function encodedEdition(token) {
  return BigInt(token) >> 128n;
}
export async function readLegacyCollectors(record, cursor, fetcher = fetch) {
  try {
    if (
      record.chainId !== 1 ||
      record.factoryVersion !== 0 ||
      record.factory?.toLowerCase() !==
        "0x78e3adc0e811e4f93bd9f1f9389b923c9a3355c2" ||
      !Number.isSafeInteger(record.legacyEditionId) ||
      record.legacyEditionId < 1 ||
      !/^0x[0-9a-f]{40}$/i.test(record.contract)
    )
      throw Error("Invalid edition");
    const url = new URL(
      `https://eth.blockscout.com/api/v2/tokens/${record.contract}/instances`,
    );
    if (cursor) {
      if (cursor.length > 2048) throw Error("Invalid cursor");
      const c = JSON.parse(Buffer.from(cursor, "base64url").toString());
      for (const [k, v] of Object.entries(c)) {
        if (
          !["unique_token", "items_count"].includes(k) ||
          !/^\d{1,78}$/.test(String(v))
        )
          throw Error("Invalid cursor");
        url.searchParams.set(k, String(v));
      }
    }
    const res = await fetcher(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw Error("Index unavailable");
    const d = parseTokenPage(await res.text());
    if (!Array.isArray(d.items)) throw Error("Invalid index");
    let block = null;
    async function rpc(method, params) {
      const res = await fetcher("https://ethereum-rpc.publicnode.com", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(8000),
      });
      const d = await res.json();
      if (!res.ok || d.error || !d.result)
        throw Error("Edition mapping unavailable");
      return d.result;
    }
    const tokens = d.items.slice(0, 50);
    for (const token of tokens)
      if (typeof token.id !== "string" || !/^\d{1,78}$/.test(token.id))
        throw Error("Invalid token ID");
    const sequential = tokens.filter((t) => encodedEdition(t.id) === 0n),
      mapped = new Map();
    if (sequential.length) {
      block = await rpc("eth_blockNumber", []);
      const res = await fetcher("https://ethereum-rpc.publicnode.com", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(12000),
        body: JSON.stringify(
          sequential.map((t, id) => ({
            jsonrpc: "2.0",
            id,
            method: "eth_call",
            params: [
              {
                to: record.contract,
                data:
                  toFunctionSelector("tokenToEdition(uint256)") +
                  BigInt(t.id).toString(16).padStart(64, "0"),
              },
              block,
            ],
          })),
        ),
      });
      const values = await res.json();
      if (
        !res.ok ||
        !Array.isArray(values) ||
        values.length !== sequential.length
      )
        throw Error("Edition mappings unavailable");
      for (const v of values) {
        if (
          !Number.isInteger(v.id) ||
          v.id < 0 ||
          v.id >= sequential.length ||
          v.error ||
          !/^0x[0-9a-f]+$/i.test(v.result || "")
        )
          throw Error("Invalid edition mapping");
        mapped.set(sequential[v.id].id, BigInt(v.result));
      }
      if (mapped.size !== sequential.length) throw Error("Incomplete mappings");
    }
    const items = new Map();
    for (const token of tokens) {
      const edition = mapped.get(token.id) ?? encodedEdition(token.id);
      if (edition !== BigInt(record.legacyEditionId)) continue;
      const address = token.owner?.hash?.toLowerCase();
      if (!/^0x[0-9a-f]{40}$/.test(address || "") || /^0x0{40}$/.test(address))
        continue;
      const h = items.get(address) || { address, balance: "0", tokenIds: [] };
      h.tokenIds.push(token.id);
      h.balance = String(h.tokenIds.length);
      items.set(address, h);
    }
    return {
      status: "indexed",
      scope: "legacy-release",
      items: [...items.values()],
      nextCursor: d.next_page_params
        ? Buffer.from(JSON.stringify(d.next_page_params)).toString("base64url")
        : null,
      source: url.href,
      checkedAt: new Date().toISOString(),
      editionId: record.legacyEditionId,
      scannedTokens: d.items.length,
      blockNumber: block ? parseInt(block, 16) : null,
    };
  } catch {
    return {
      status: "unavailable",
      scope: "legacy-release",
      message:
        "The legacy edition holder page could not be verified. Retry preserves already loaded collectors.",
    };
  }
}
