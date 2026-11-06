import { isSolanaAsset } from "./solana-identity.mjs";
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
