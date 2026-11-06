import { decodeEventLog, parseAbiItem } from "viem";
const purchase = parseAbiItem(
  "event TokenPurchased(uint256 indexed tokenId,uint256 indexed amount,address indexed buyer,address referrer0,address referrer1)",
);
const transfer = parseAbiItem(
  "event Transfer(address indexed from,address indexed to,uint256 value)",
);
export const BASE_USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const lower = (x) => String(x || "").toLowerCase();
export function verifyCatalogPayment(event, receipt, config) {
  if (
    String(event.chain_id) !== "8453" ||
    receipt?.status !== "0x1" ||
    lower(receipt.transactionHash) !== lower(event.purchased_at_tx_hash) ||
    BigInt(receipt.blockNumber) !== BigInt(event.purchased_at_block_number)
  )
    throw Error("Receipt does not match successful Base purchase");
  if (
    !config ||
    lower(config.contract_address) !==
      "0xbceabfcc30a0e050367a6a5faea247a43c314709" ||
    config.token_id !== event.cr_token_id
  )
    throw Error("Unknown historical USDC payout configuration");
  const logs = receipt.logs.filter(
    (log) =>
      !log.removed &&
      lower(log.transactionHash) === lower(receipt.transactionHash) &&
      lower(log.blockHash) === lower(receipt.blockHash),
  );
  const purchases = logs.flatMap((log) => {
    try {
      return [
        {
          ...decodeEventLog({ abi: [purchase], ...log }),
          address: log.address,
        },
      ];
    } catch {
      return [];
    }
  });
  if (purchases.length !== 1)
    throw Error("Multiple or missing purchases require allocation review");
  const p = purchases[0];
  if (
    lower(p.address) !== lower(event.contract_address) ||
    p.args.tokenId !== BigInt(event.token_id) ||
    p.args.amount !== BigInt(event.amount) ||
    lower(p.args.buyer) !== lower(event.recipient)
  )
    throw Error("Token purchase event mismatch");
  const transfers = logs
    .filter((log) => lower(log.address) === BASE_USDC)
    .flatMap((log) => {
      try {
        return [decodeEventLog({ abi: [transfer], ...log }).args];
      } catch {
        return [];
      }
    })
    .filter((t) => lower(t.from) === lower(event.from));
  const gross = BigInt(event.value),
    artist = BigInt(event.value_received_by_artist),
    platform = BigInt(event.value_received_by_platform),
    referrals =
      BigInt(event.value_received_by_referral0) +
      BigInt(event.value_received_by_referral1);
  if (
    [gross, artist, platform, referrals].some((n) => n < 0n) ||
    gross !== artist + platform + referrals
  )
    throw Error("Payment allocation mismatch");
  if (transfers.reduce((sum, t) => sum + t.value, 0n) !== gross)
    throw Error("USDC debit does not match gross purchase");
  if (
    transfers
      .filter((t) => lower(t.to) === lower(config.token_payout_address))
      .reduce((sum, t) => sum + t.value, 0n) !== artist
  )
    throw Error("Artist payout does not match USDC transfer");
  return {
    id: event.id,
    transaction: receipt.transactionHash,
    blockHash: receipt.blockHash,
    date: event.purchased_at_timestamp,
    grossRaw: gross.toString(),
    artistRaw: artist.toString(),
    platformRaw: platform.toString(),
    referralsRaw: referrals.toString(),
    artistPayoutAddress: lower(config.token_payout_address),
    currency: BASE_USDC,
  };
}
export function usdc(raw) {
  const n = BigInt(raw);
  const frac = (n % 1000000n).toString().padStart(6, "0").replace(/0+$/, "");
  return (n / 1000000n).toString() + (frac ? "." + frac : "");
}
export function summarizePayments(events) {
  const unique = [...new Map(events.map((e) => [e.id, e])).values()];
  const total = (field) =>
    usdc(unique.reduce((n, e) => n + BigInt(e[field]), 0n));
  return {
    artistPaid: total("artistRaw"),
    gross: total("grossRaw"),
    platformPaid: total("platformRaw"),
    referralsPaid: total("referralsRaw"),
    purchaseCount: unique.length,
    events: unique.map((e) => ({ ...e, gross: usdc(e.grossRaw) })),
  };
}
