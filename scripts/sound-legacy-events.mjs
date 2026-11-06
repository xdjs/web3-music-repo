export const mintTransferTopic =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export const zeroTopic = "0x" + "0".repeat(64);
export const purchaseTopics = [
  "0xe38cb07a52e5d88a83de7c9d29c2841118103e462d20f8c526b35872f9977785",
  "0xc3e4ad784e3889561b308df24921cf08a47410a8ed63b8afe80c50a002efb251",
];
const word = (value) => /^0x[0-9a-f]{64}$/i.test(value || "");
export function decodeLegacyMint(event, contract) {
  if (
    event.address?.toLowerCase() !== contract.toLowerCase() ||
    event.topics?.[0] !== mintTransferTopic ||
    event.topics[1] !== zeroTopic ||
    !word(event.topics[3])
  )
    return null;
  return {
    tokenId: BigInt(event.topics[3]).toString(),
    blockNumber: parseInt(event.blockNumber, 16),
    transaction: event.transactionHash,
  };
}
export function decodeLegacyPurchase(event, contract, mintIds) {
  if (
    event.address?.toLowerCase() !== contract.toLowerCase() ||
    !purchaseTopics.includes(event.topics?.[0]) ||
    !word(event.topics[1]) ||
    !word(event.topics[2])
  )
    return null;
  const tokenId = BigInt(event.topics[2]).toString();
  if (!mintIds.has(tokenId)) return null;
  return {
    editionId: BigInt(event.topics[1]).toString(),
    tokenId,
    blockNumber: parseInt(event.blockNumber, 16),
    transaction: event.transactionHash,
  };
}
