import { resolveWalletName } from "./wallet-name.mjs";
const isAddress = (s) => /^0x[0-9a-f]{40}$/i.test(s || "");
const fold = (s) =>
  String(s || "")
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .trim();
const safeURL = (s) =>
  typeof s === "string" && /^https:\/\//.test(s) ? s : null;
function slug(p) {
  try {
    return decodeURIComponent(
      new URL(p.soundURL).pathname.split("/").filter(Boolean).at(-1) || "",
    );
  } catch {
    return "";
  }
}

// Names are search labels, never wallet identities. Every result keeps its explicit address.
export function createCollectorSearch(historical, resolve = resolveWalletName) {
  const profiles = historical.filter((p) => isAddress(p.address));
  const cache = new Map(),
    pending = new Map();
  async function ens(name) {
    const key = fold(name),
      prior = cache.get(key);
    if (prior?.expires > Date.now()) return prior.value;
    if (pending.has(key)) return pending.get(key);
    const task = (async () => {
      let value;
      try {
        value = await resolve(name);
      } catch {
        value = {
          status: "unavailable",
          message: "ENS lookup is temporarily unavailable.",
        };
      }
      if (
        value.status === "resolved" &&
        (!isAddress(value.address) || /^0x0{40}$/i.test(value.address))
      )
        value = {
          status: "unavailable",
          message: "ENS lookup returned an invalid address.",
        };
      cache.set(key, {
        value,
        expires: Date.now() + (value.status === "unavailable" ? 15000 : 300000),
      });
      if (cache.size > 500) cache.delete(cache.keys().next().value);
      return value;
    })().finally(() => pending.delete(key));
    pending.set(key, task);
    return task;
  }
  return async (input) => {
    if (
      typeof input !== "string" ||
      input.length > 255 ||
      /[\u0000-\u001f\u007f]/u.test(input)
    )
      return {
        status: "invalid",
        items: [],
        message: "Enter a collector name, ENS name, or full wallet address.",
      };
    const query = input.trim(),
      q = fold(query);
    if (q.length < 2)
      return {
        status: "invalid",
        query,
        items: [],
        message: "Enter at least two characters.",
      };
    const matches = profiles
      .map((p) => ({ p, name: fold(p.name), slug: fold(slug(p)) }))
      .filter(
        ({ p, name, slug }) =>
          name.includes(q) ||
          slug.includes(q) ||
          p.address.toLowerCase().startsWith(q),
      )
      .sort((a, b) => {
        const rank = (x) =>
          x.name === q || x.slug === q
            ? 0
            : x.name.startsWith(q) || x.slug.startsWith(q)
              ? 1
              : 2;
        return (
          rank(a) - rank(b) ||
          String(b.p.capturedAt || "").localeCompare(
            String(a.p.capturedAt || ""),
          ) ||
          a.p.address.localeCompare(b.p.address)
        );
      });
    const byAddress = new Map();
    for (const { p } of matches) {
      const address = p.address.toLowerCase();
      if (byAddress.has(address)) continue;
      byAddress.set(address, {
        address,
        name: p.name || null,
        avatarURL: p.localAvatar?.startsWith("/collectors/")
          ? p.localAvatar
          : safeURL(p.avatarURL),
        sourceType: "historical-sound",
        source: safeURL(p.source),
        capturedAt: p.capturedAt || null,
      });
    }
    let resolution;
    if (isAddress(query)) {
      const address = query.toLowerCase(),
        known = profiles.find((p) => p.address.toLowerCase() === address);
      byAddress.set(address, {
        address,
        name: known?.name || null,
        avatarURL: known?.localAvatar?.startsWith("/collectors/")
          ? known.localAvatar
          : null,
        sourceType: "wallet-address",
        source: null,
        ...(known ? { capturedAt: known.capturedAt } : {}),
      });
    } else if (q.includes(".") && !/[\s/:@?#]/u.test(query)) {
      resolution = await ens(query);
      if (resolution.status === "resolved") {
        const address = resolution.address.toLowerCase(),
          known = byAddress.get(address);
        byAddress.delete(address);
        const result = {
          address,
          name: resolution.name,
          avatarURL: known?.avatarURL || null,
          sourceType: "ens",
          source: safeURL(resolution.source),
          checkedAt: resolution.checkedAt,
        };
        const existing = [...byAddress];
        byAddress.clear();
        byAddress.set(address, result);
        for (const [a, p] of existing) byAddress.set(a, p);
      }
    }
    const total = byAddress.size,
      items = [...byAddress.values()].slice(0, 20);
    return {
      status:
        resolution?.status === "unavailable"
          ? items.length
            ? "partial"
            : "unavailable"
          : "ok",
      query,
      items,
      total,
      truncated: total > items.length,
      ...(resolution ? { ens: resolution } : {}),
      scope:
        "Public wallet addresses, forward-resolved ENS names, and names preserved in historical Sound profiles. Names may match more than one wallet.",
    };
  };
}
