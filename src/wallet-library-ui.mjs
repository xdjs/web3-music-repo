export function mountWalletLibrary({ esc, catalog, card, rerender }) {
  const states = new Map();
  let active = "";
  const chains = {
    1: "Ethereum",
    10: "Optimism",
    8453: "Base",
    137: "Polygon",
    7777777: "Zora",
  };
  function view(address = "", embedded = false) {
    active = address.toLowerCase();
    const valid = /^0x[0-9a-f]{40}$/.test(active);
    return `<div class="intro"><div>${embedded ? "<h2>My collection</h2>" : "<h1>Your collected music</h1>"}<p>Explore a public wallet’s music. No signature is needed to listen.</p></div></div><form id="wallet-lookup"><label class="artist-search-label">Wallet address<input name="address" placeholder="0x…" value="${esc(address)}" pattern="0x[a-fA-F0-9]{40}" required></label><button class="outline-button">Find collected music</button></form>${
      valid
        ? `<p class="link-note">Current holdings are checked separately on each network. Matches use the recovered archive; unmatched NFTs may include music still awaiting recovery.</p>${Object.entries(
            chains,
          )
            .map(([id, name]) => {
              const s = states.get(active + ":" + id);
              const recordIds = [
                ...new Set(
                  (s?.items || []).map((i) => i.recordId).filter(Boolean),
                ),
              ];
              return `<section class="section"><div class="section-head"><div><h2>${name}</h2><p>${s ? `${s.items.length} token entries checked · ${recordIds.length} archive matches${s.nextCursor ? " · more pages available" : ""}` : "Not scanned yet"}</p></div><button class="outline-button" data-wallet-chain="${id}" ${s?.loading ? "disabled" : ""}>${s?.loading ? "Scanning…" : s?.error ? "Retry" : s?.nextCursor ? "Load next page" : s ? "Refresh" : "Scan network"}</button></div>${s?.error ? `<p class="notice">${esc(s.error)}</p>` : ""}<div class="cards library-grid">${recordIds
                .map((id) => catalog().find((r) => r.id === id))
                .filter(Boolean)
                .map(card)
                .join(
                  "",
                )}</div>${s && !s.loading && !s.error ? `<p class="link-note">${s.items.filter((i) => !i.recordId).length} token entries are not yet matched to a recording. ${s.nextCursor ? "This scan is partial." : "All pages returned by this index have been read."} Open a song to play it or add it to a playlist.</p>` : ""}</section>`;
            })
            .join("")}`
        : ""
    }`;
  }
  document.addEventListener("submit", (e) => {
    if (e.target.id !== "wallet-lookup") return;
    e.preventDefault();
    location.hash =
      (location.hash.startsWith("#me")
        ? "me?tab=collection&wallet="
        : "wallet/") + new FormData(e.target).get("address").trim();
  });
  document.addEventListener("click", async (e) => {
    const button = e.target.closest("[data-wallet-chain]");
    if (!button) return;
    const chain = button.dataset.walletChain,
      address = active,
      key = address + ":" + chain;
    let s = states.get(key) || { items: [], nextCursor: null };
    if (s.loading) return;
    const cursor = s.nextCursor;
    if (!cursor && !s.error) s = { items: [], nextCursor: null };
    s.loading = true;
    s.error = null;
    states.set(key, s);
    rerender();
    try {
      const r = await fetch(
        `/api/wallet/${address}?chainId=${chain}${cursor ? "&cursor=" + encodeURIComponent(cursor) : ""}`,
      );
      const d = await r.json();
      if (d.status !== "indexed")
        throw Error(d.message || "Network unavailable");
      const seen = new Set(s.items.map((i) => i.contract + ":" + i.tokenId));
      s.items.push(
        ...d.items.filter((i) => !seen.has(i.contract + ":" + i.tokenId)),
      );
      if (d.nextCursor && d.nextCursor === cursor)
        throw Error("Indexer repeated a page. Retry later.");
      s.nextCursor = d.nextCursor;
      s.checkedAt = d.checkedAt;
    } catch (e) {
      s.error = e.message;
    } finally {
      s.loading = false;
      if (active === address) rerender();
    }
  });
  return { view };
}
