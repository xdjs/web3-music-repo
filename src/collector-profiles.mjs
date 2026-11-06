import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
const client = createPublicClient({
  chain: mainnet,
  transport: http("https://ethereum-rpc.publicnode.com", {
    timeout: 8000,
    retryCount: 0,
  }),
  ccipRead: false,
});
export async function resolveWalletIdentity(address, resolver = client) {
  if (!/^0x[0-9a-f]{40}$/i.test(address)) return { status: "invalid" };
  try {
    const name = await resolver.getEnsName({ address });
    if (!name) return { status: "not-configured" };
    const forward = await resolver.getEnsAddress({ name });
    if (forward?.toLowerCase() !== address.toLowerCase())
      return { status: "not-configured" };
    let avatarConfigured = false;
    try {
      avatarConfigured = !!(await resolver.getEnsText({ name, key: "avatar" }));
    } catch {}
    return {
      status: "verified",
      name,
      avatarURL: avatarConfigured
        ? `https://metadata.ens.domains/mainnet/avatar/${encodeURIComponent(name)}`
        : null,
      source: `https://app.ens.domains/${encodeURIComponent(name)}`,
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return {
      status: "unavailable",
      message: "Current ENS profile could not be resolved. Retry later.",
    };
  }
}
export function createProfileReader(
  historical,
  resolve = resolveWalletIdentity,
) {
  const byAddress = new Map(
    historical.map((p) => [p.address.toLowerCase(), p]),
  );
  const cache = new Map(),
    pending = new Map();
  return async (address) => {
    address = address.toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(address)) return { status: "invalid" };
    if (cache.has(address) && cache.get(address).expires > Date.now())
      return cache.get(address).value;
    if (pending.has(address)) return pending.get(address);
    const task = (async () => {
      const ens = await resolve(address),
        archived = byAddress.get(address) || null;
      const value = {
        address,
        ens,
        archived,
        name: ens.status === "verified" ? ens.name : archived?.name || null,
        avatarURL:
          archived?.localAvatar ||
          (ens.status === "verified" ? ens.avatarURL : null) ||
          archived?.avatarURL ||
          null,
        avatarSource: archived?.localAvatar
          ? "Sound profile · " + archived.capturedAt
          : ens.status === "verified" && ens.avatarURL
            ? "ENS avatar · current"
            : archived?.avatarURL
              ? "Sound profile · " + archived.capturedAt
              : null,
      };
      cache.set(address, {
        value,
        expires: Date.now() + (ens.status === "unavailable" ? 15000 : 900000),
      });
      if (cache.size > 500) cache.delete(cache.keys().next().value);
      return value;
    })().finally(() => pending.delete(address));
    pending.set(address, task);
    return task;
  };
}
