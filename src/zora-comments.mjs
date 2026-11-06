import { decodeEventLog, parseAbiItem } from "viem";

export const mintCommentABI = parseAbiItem(
  "event MintComment(address indexed sender,address indexed tokenContract,uint256 indexed tokenId,uint256 quantity,string comment)",
);
const transferABI = parseAbiItem(
  "event TransferSingle(address indexed operator,address indexed from,address indexed to,uint256 id,uint256 value)",
);
const zero = "0x0000000000000000000000000000000000000000";
const address = (value) => String(value || "").toLowerCase();

// A known minter can be called directly: its event alone is not proof of a mint.
// Require the canonical receipt log and a matching token mint in that receipt.
export function verifiedMintComment(
  log,
  receipt,
  { chainId, emitter, endBlock },
) {
  if (
    log.removed ||
    address(log.address) !== address(emitter) ||
    receipt?.status !== "0x1" ||
    address(receipt.transactionHash) !== address(log.transactionHash) ||
    address(receipt.blockHash) !== address(log.blockHash) ||
    BigInt(log.blockNumber) > BigInt(endBlock)
  )
    return null;
  const included = receipt.logs?.some(
    (item) =>
      item.logIndex === log.logIndex &&
      address(item.address) === address(log.address) &&
      item.data === log.data &&
      JSON.stringify(item.topics) === JSON.stringify(log.topics),
  );
  if (!included) return null;
  try {
    const args = decodeEventLog({ abi: [mintCommentABI], ...log }).args;
    if (!args.comment.trim() || args.quantity <= 0n) return null;
    const minted = receipt.logs.some((item) => {
      if (address(item.address) !== address(args.tokenContract)) return false;
      try {
        const transfer = decodeEventLog({ abi: [transferABI], ...item }).args;
        return (
          address(transfer.from) === zero &&
          address(transfer.to) === address(args.sender) &&
          transfer.id === args.tokenId &&
          transfer.value === args.quantity
        );
      } catch {
        return false;
      }
    });
    if (!minted) return null;
    return {
      id: `${chainId}:${log.transactionHash}:${BigInt(log.logIndex)}`,
      chainId,
      contract: address(args.tokenContract),
      tokenId: args.tokenId.toString(),
      recipient: address(args.sender),
      message: args.comment,
      quantity: args.quantity.toString(),
      transaction: log.transactionHash,
      blockHash: log.blockHash,
      blockNumber: Number(BigInt(log.blockNumber)),
      logIndex: Number(BigInt(log.logIndex)),
      emitter: address(emitter),
      verification: "official-minter-and-matching-mint-receipt",
    };
  } catch {
    return null;
  }
}

export function commentsForRecord(record, comments) {
  return comments.filter(
    (comment) =>
      comment.verification === "official-minter-and-matching-mint-receipt" &&
      comment.chainId === record.chainId &&
      address(comment.contract) === address(record.contract) &&
      comment.tokenId === String(record.tokenId),
  );
}
