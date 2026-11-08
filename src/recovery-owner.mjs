import {
  isIndexedRelease,
  unsupportedIndexedRead,
} from "./asset-capabilities.mjs";
import { isSolanaAsset, unsupportedSolanaRead } from "./asset-capabilities.mjs";
const rpcs = {
  1: "https://ethereum-rpc.publicnode.com",
  10: "https://optimism-rpc.publicnode.com",
  8453: "https://base-rpc.publicnode.com",
  137: "https://polygon-bor-rpc.publicnode.com",
  7777777: "https://rpc.zora.energy",
};
export async function readOwner(record, fetcher = fetch) {
  if (isIndexedRelease(record)) return unsupportedIndexedRead();
  if (isSolanaAsset(record)) return unsupportedSolanaRead("ownership");
  if (record.standard === "ERC20")
    return {
      status: "unsupported",
      message:
        "This content coin is fungible and has no single NFT owner. Coin-holder balances are not NFT editions.",
    };
  if (record.standard === "ERC1155")
    return {
      status: "unsupported",
      message:
        "This ERC-1155 edition can have multiple holders. Holder enumeration is not implemented yet.",
    };
  // Earlier catalog records omit the standard and use ERC-721 token IDs.
  // Only that legacy omission may default; unknown explicit standards must not.
  if (record.standard !== undefined && record.standard !== "ERC721")
    return {
      status: "unsupported",
      message: "Owner lookup is not supported for this token standard.",
    };
  try {
    if (
      !rpcs[record.chainId] ||
      !/^0x[0-9a-f]{40}$/i.test(record.contract) ||
      !/^\d{1,78}$/.test(record.tokenId) ||
      BigInt(record.tokenId) >= 1n << 256n
    )
      throw Error("Invalid reference");
    const rpc = async (method, params) => {
      const r = await fetcher(rpcs[record.chainId], {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) throw Error();
      const d = await r.json();
      if (d.error || !d.result) throw Error();
      return d.result;
    };
    const block = await rpc("eth_blockNumber", []);
    const raw = await rpc("eth_call", [
      {
        to: record.contract,
        data:
          "0x6352211e" + BigInt(record.tokenId).toString(16).padStart(64, "0"),
      },
      block,
    ]);
    if (!/^0x0{24}[a-f0-9]{40}$/i.test(raw) || /^0x0+$/.test(raw))
      throw Error();
    return {
      status: "verified",
      address: "0x" + raw.slice(-40),
      blockNumber: parseInt(block, 16),
      checkedAt: new Date().toISOString(),
      tokenId: record.tokenId,
      source: "ownerOf contract read",
    };
  } catch {
    return {
      status: "unavailable",
      message:
        "The owner lookup could not be completed. Retry to read the contract again.",
    };
  }
}
