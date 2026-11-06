import { decodeEventLog, parseAbiItem } from "viem";

// Official mainnet address; ABI is pinned from this deployment's verified source,
// whose indexed recipient differs from the current repository's source.
export const CATALOG_ETH_ASKS = "0x6170b3c3a54c3d8c854934cbc314ed479b2b29a3";
export const ETH = "0x0000000000000000000000000000000000000000";
export const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
export const ROYALTY_ABI = parseAbiItem(
  "event RoyaltyPayout(address indexed tokenContract,uint256 indexed tokenId,address indexed recipient,uint256 amount)",
);
export const ASK_ABI = parseAbiItem(
  "event AskFilled(address indexed tokenContract,uint256 indexed tokenId,address indexed buyer,address finder,(address seller,address sellerFundsRecipient,address askCurrency,uint16 findersFeeBps,uint256 askPrice) ask)",
);
const NFT_TRANSFER = parseAbiItem(
  "event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)",
);
const TOKEN_TRANSFER = parseAbiItem(
  "event Transfer(address indexed from,address indexed to,uint256 value)",
);
const lower = (x) => String(x || "").toLowerCase();
const integer = (x) => typeof x === "string" && /^(0|[1-9][0-9]*)$/.test(x);
function decode(logs, abi, emitter) {
  return logs
    .filter((l) => lower(l.address) === emitter)
    .flatMap((log) => {
      try {
        return [
          { ...decodeEventLog({ abi: [abi], ...log, strict: true }), log },
        ];
      } catch {
        return [];
      }
    });
}
export function verifyCatalogEthereumRoyalty(candidate, receipt, chainId) {
  if (
    chainId !== "0x1" ||
    candidate.chainId !== 1 ||
    !integer(candidate.tokenId) ||
    !integer(candidate.blockNumber)
  )
    throw Error("Invalid exact Ethereum identity");
  if (
    receipt?.status !== "0x1" ||
    lower(receipt.transactionHash) !== lower(candidate.transactionHash) ||
    BigInt(receipt.blockNumber) !== BigInt(candidate.blockNumber)
  )
    throw Error("Successful receipt identity mismatch");
  const logs = receipt.logs;
  if (
    !Array.isArray(logs) ||
    logs.some(
      (l) =>
        l.removed ||
        lower(l.transactionHash) !== lower(receipt.transactionHash) ||
        lower(l.blockHash) !== lower(receipt.blockHash) ||
        BigInt(l.blockNumber) !== BigInt(receipt.blockNumber),
    )
  )
    throw Error("Receipt log provenance mismatch");
  if (new Set(logs.map((l) => l.logIndex)).size !== logs.length)
    throw Error("Duplicate log indices");
  const asks = decode(logs, ASK_ABI, CATALOG_ETH_ASKS);
  if (asks.length !== 1)
    throw Error(
      "Missing or multiple supported sales require allocation review",
    );
  const ask = asks[0];
  if (
    lower(ask.args.tokenContract) !== lower(candidate.contract) ||
    ask.args.tokenId !== BigInt(candidate.tokenId)
  )
    throw Error("Sale token mismatch");
  const currency = lower(ask.args.ask.askCurrency);
  if (![ETH, WETH].includes(currency))
    throw Error("Currency requires separate transfer/decimals review");
  if (ask.args.ask.askPrice <= 0n) throw Error("Nonpositive sale amount");
  const royalties = decode(logs, ROYALTY_ABI, CATALOG_ETH_ASKS).filter(
    (r) =>
      lower(r.args.tokenContract) === lower(candidate.contract) &&
      r.args.tokenId === BigInt(candidate.tokenId),
  );
  if (
    royalties.some((r) => BigInt(r.log.logIndex) >= BigInt(ask.log.logIndex)) ||
    royalties.reduce((n, r) => n + r.args.amount, 0n) > ask.args.ask.askPrice
  )
    throw Error("Royalty allocation does not match sale");
  const matches = royalties.filter(
    (r) => lower(r.args.recipient) === lower(candidate.recipient),
  );
  if (
    matches.length !== 1 ||
    matches[0].args.amount <= 0n ||
    lower(candidate.recipient) === ETH
  )
    throw Error("Missing, ambiguous or invalid royalty recipient");
  const royalty = matches[0];
  const transfers = decode(
    logs,
    NFT_TRANSFER,
    lower(candidate.contract),
  ).filter(
    (t) =>
      t.args.tokenId === BigInt(candidate.tokenId) &&
      lower(t.args.from) === lower(ask.args.ask.seller) &&
      lower(t.args.to) === lower(ask.args.buyer),
  );
  if (transfers.length !== 1) throw Error("Sale lacks exact NFT transfer");
  if (currency === WETH) {
    const paid = decode(logs, TOKEN_TRANSFER, WETH).filter(
      (t) =>
        lower(t.args.from) === CATALOG_ETH_ASKS &&
        lower(t.args.to) === lower(candidate.recipient) &&
        t.args.value === royalty.args.amount,
    );
    if (paid.length !== 1)
      throw Error("WETH royalty transfer requires allocation review");
  }
  return {
    id: `1:${lower(receipt.transactionHash)}:${BigInt(royalty.log.logIndex)}`,
    sourceEventId: candidate.sourceEventId,
    chainId: 1,
    contract: lower(candidate.contract),
    tokenId: candidate.tokenId,
    transactionHash: lower(receipt.transactionHash),
    blockHash: lower(receipt.blockHash),
    blockNumber: candidate.blockNumber,
    logIndex: BigInt(royalty.log.logIndex).toString(),
    emitter: CATALOG_ETH_ASKS,
    royaltyRecipient: lower(royalty.args.recipient),
    royaltyRaw: royalty.args.amount.toString(),
    saleCurrency: currency,
    currencySymbol: currency === ETH ? "ETH" : "WETH",
    decimals: 18,
    settlementScope:
      currency === ETH
        ? "Successful royalty payout event; native ETH or contract-permitted WETH fallback"
        : "Royalty event corroborated by exact WETH transfer",
    grossSaleRaw: ask.args.ask.askPrice.toString(),
    seller: lower(ask.args.ask.seller),
    sellerFundsRecipient: lower(ask.args.ask.sellerFundsRecipient),
    buyer: lower(ask.args.buyer),
    scope:
      "Royalty recipient payment for one historical sale, not net artist income or all-platform revenue",
  };
}
