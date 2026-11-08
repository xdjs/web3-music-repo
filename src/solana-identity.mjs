// Asset identity is network-specific. Solana public keys are case-sensitive;
// never normalize them as EVM hex addresses or invent an NFT token ID.
const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function isSolanaMint(value) {
  if (typeof value !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value))
    return false;
  let number = 0n;
  for (const character of value)
    number = number * 58n + BigInt(BASE58.indexOf(character));
  let bytes = 0;
  while (number) {
    bytes++;
    number >>= 8n;
  }
  return bytes + value.match(/^1*/)[0].length === 32;
}
export function isSolanaAsset(record) {
  return record?.chainId === "solana" || record?.network === "solana";
}
export function solanaMintIdentity(nft) {
  if (
    nft?.chainId !== "solana" ||
    !isSolanaMint(nft.contractAddress) ||
    String(nft.nftFactoryByNftFactoryId?.standard || "").toUpperCase() !==
      "METAPLEX" ||
    nft.tokenId !== null ||
    (nft.id !== undefined && nft.id !== nft.contractAddress)
  )
    return null;
  return { chainId: "solana", mint: nft.contractAddress, standard: "METAPLEX" };
}
export function assetCollectionKey(record) {
  if (record?.assetType === "indexed-release") return null;
  if (isSolanaAsset(record))
    return isSolanaMint(record.mint) ? `solana:${record.mint}` : null;
  if (
    !Number.isSafeInteger(Number(record?.chainId)) ||
    Number(record.chainId) <= 0 ||
    !/^0x[0-9a-f]{40}$/i.test(record?.contract || "")
  )
    return null;
  return `${Number(record.chainId)}:${record.contract.toLowerCase()}`;
}
export function assetIdentityKey(record) {
  const collection = assetCollectionKey(record);
  if (!collection) return null;
  if (isSolanaAsset(record)) return collection;
  if (record.standard === "ERC20" && record.tokenId == null)
    return `${collection}:coin`;
  if (
    typeof record.tokenId === "number" &&
    !Number.isSafeInteger(record.tokenId)
  )
    return null;
  if (!/^\d+$/.test(String(record.tokenId ?? ""))) return null;
  return `${collection}:${BigInt(record.tokenId)}`;
}
