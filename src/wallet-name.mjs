import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";

const client = createPublicClient({
  chain: mainnet,
  transport: http("https://ethereum-rpc.publicnode.com", {
    timeout: 8000,
    retryCount: 0,
  }),
  // A supplied name must not cause arbitrary resolver-controlled HTTP requests.
  ccipRead: false,
});

export async function resolveWalletName(input, resolver = client) {
  let name;
  try {
    if (typeof input !== "string" || input.length > 255)
      throw Error("Invalid name");
    const value = input.trim();
    if (!value || /[\s/:@?#]/u.test(value)) throw Error("Invalid name");
    name = normalize(value);
    if (!name.includes(".") || name.length > 255) throw Error("Invalid name");
  } catch {
    return {
      status: "invalid",
      message: "Enter an ENS name such as name.eth, or a full wallet address.",
    };
  }
  try {
    const address = await resolver.getEnsAddress({ name });
    if (!address || /^0x0{40}$/i.test(address))
      return {
        status: "not-found",
        name,
        message: "No Ethereum wallet address is assigned to this ENS name.",
      };
    if (!/^0x[0-9a-f]{40}$/i.test(address))
      throw Error("Invalid resolver response");
    return {
      status: "resolved",
      name,
      address,
      checkedAt: new Date().toISOString(),
      source: `https://app.ens.domains/${encodeURIComponent(name)}`,
    };
  } catch {
    return {
      status: "unavailable",
      name,
      message:
        "This ENS name could not be resolved right now. Retry or enter the wallet address directly.",
    };
  }
}
