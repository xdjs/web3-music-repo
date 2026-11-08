import { assetIdentityKey, isSolanaAsset } from "./solana-identity.mjs";
export { isSolanaAsset };
export function unsupportedSolanaRead(operation = "collectors") {
  const metadata = operation === "metadata";
  return {
    status: "unsupported",
    scope: "solana-mint",
    chainId: "solana",
    items: [],
    message: metadata
      ? "Solana mint metadata verification is not implemented yet. Preserved index references remain available; they are not a current chain read."
      : "Solana ownership recovery is not implemented yet. Current holders and wallet-owned Nina collections are unavailable; this does not mean the mint has no collectors.",
  };
}

// Index-only recordings deliberately have no blockchain identity. A platform's
// network label is not a mint or a verified token mapping.
export function isIndexedRelease(record) {
  return record?.assetType === "indexed-release";
}
export function hasTokenIdentity(record) {
  return !isIndexedRelease(record) && Boolean(assetIdentityKey(record));
}
export function unsupportedIndexedRead() {
  return {
    status: "unsupported",
    scope: "unconfirmed-mint",
    items: [],
    message:
      "An NFT identity has not been established for this recording. Collectors, ownership, and onchain revenue cannot be attributed yet; this does not mean it was never minted or has no collectors.",
  };
}
export function recordNetworkLabel(record) {
  return isIndexedRelease(record) ? "Mint unconfirmed" : null;
}
