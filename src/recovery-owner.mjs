const rpcs = {
  1: "https://ethereum-rpc.publicnode.com",
  10: "https://optimism-rpc.publicnode.com",
  8453: "https://base-rpc.publicnode.com",
  7777777: "https://rpc.zora.energy",
};
export async function readOwner(record, fetcher = fetch) {
  if (record.standard === "ERC1155")
    return {
      status: "unsupported",
      message:
        "This ERC-1155 edition can have multiple holders. Holder enumeration is not implemented yet.",
    };
  try {
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
