import { normalizeWallet } from "./wallet-library-state.mjs";

export function collectorQueryKind(query) {
  const value = String(query || "").trim();
  if (normalizeWallet(value)) return "wallet";
  if (value.length <= 255 && /^[^\s/:?#@]+\.[^\s/:?#@]+$/u.test(value))
    return "ens";
  return "name";
}

// Display names never select a wallet, even if only one historical match exists.
export function exactCollectorAddress(query, result) {
  const address = normalizeWallet(String(query || "").trim());
  if (address) return address;
  if (collectorQueryKind(query) !== "ens") return "";
  const resolved = result?.ens;
  return resolved?.status === "resolved" &&
    String(resolved.name || "").toLowerCase() === query.trim().toLowerCase()
    ? normalizeWallet(resolved.address)
    : "";
}

export function createCollectorSearch({
  fetchResults,
  onChange = () => {},
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  let version = 0,
    timer,
    controller;
  let state = { query: "", status: "idle", items: [] };
  const snapshot = () => state;
  function search(query, immediate = false) {
    const value = String(query || "").trim();
    clearTimer(timer);
    controller?.abort();
    const request = ++version;
    state = {
      query: value,
      status: value.length >= 2 ? "loading" : "idle",
      items: [],
    };
    onChange(state);
    if (value.length < 2) return Promise.resolve(state);
    const run = async () => {
      controller = new AbortController();
      try {
        const result = await fetchResults(value, controller.signal);
        if (request !== version) return null;
        const items = (Array.isArray(result.items) ? result.items : [])
          .filter((item) => normalizeWallet(item.address))
          .slice(0, 20);
        state = {
          ...result,
          query: value,
          items,
          status: ["ok", "partial", "unavailable", "invalid"].includes(
            result.status,
          )
            ? result.status
            : "unavailable",
        };
      } catch {
        if (request !== version) return null;
        state = { query: value, status: "unavailable", items: [] };
      }
      onChange(state);
      return state;
    };
    if (immediate) return run();
    timer = setTimer(run, 250);
    return Promise.resolve(null);
  }
  return {
    search,
    snapshot,
    cancel() {
      clearTimer(timer);
      controller?.abort();
      version++;
    },
  };
}

export function collectorSearchMarkup(state, esc) {
  if (!state.query || state.query.length < 2) return "";
  if (
    state.status === "ok" &&
    !state.items.length &&
    collectorQueryKind(state.query) === "name"
  )
    return "";
  const direct = normalizeWallet(state.query);
  const items = state.items.length
    ? state.items
    : direct
      ? [
          {
            address: direct,
            name: "View wallet collection",
            sourceType: "wallet-address",
          },
        ]
      : [];
  const notice =
    state.status === "loading"
      ? "Looking for collector profiles…"
      : state.status === "unavailable"
        ? "Collector search is temporarily unavailable. Try again; recording results are still available below."
        : state.status === "partial"
          ? "Some identity sources could not be checked. Available matches are shown."
          : !items.length
            ? "No matching collector profiles found in the recovered index."
            : "Choose a profile to explore its collected music. Historical names may belong to more than one wallet.";
  return `<section class="section" aria-label="Collector search results"><div class="section-head"><h2>Collectors</h2></div><p class="link-note" role="status">${esc(notice)}</p><div class="collector-grid">${items
    .map((item) => {
      const address = normalizeWallet(item.address);
      const label =
        item.sourceType === "ens"
          ? "ENS · resolved wallet"
          : item.sourceType === "wallet-address"
            ? "Public wallet"
            : `Historical Sound profile${item.capturedAt ? " · " + item.capturedAt : ""}`;
      return `<a class="collector-card" href="#collector/${address}" data-collector-search-result><span class="collector-avatar" aria-hidden="true"><span>${esc((item.name || address.slice(2, 4)).slice(0, 2).toUpperCase())}</span>${safeImage(item.avatarURL) ? `<img src="${esc(item.avatarURL)}" alt="" loading="lazy">` : ""}</span><span class="collector-name">${esc(item.name || address.slice(0, 8) + "…" + address.slice(-6))}<small>${esc(label)}</small><small>${esc(address.slice(0, 8) + "…" + address.slice(-6))}</small></span></a>`;
    })
    .join("")}</div></section>`;
}
function safeImage(value) {
  if (typeof value !== "string") return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
