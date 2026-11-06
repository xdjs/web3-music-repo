import {
  createWalletLibraryState,
  walletChains,
  normalizeWallet,
} from "./wallet-library-state.mjs";

export function mountWalletLibrary({ esc, catalog, card }) {
  let context = { requested: "", embedded: false };
  let lookupVersion = 0,
    lookupController = null;
  const resolvedNames = new Map();
  const state = createWalletLibraryState({
    fetchPage: async (address, chain, cursor, signal) => {
      const response = await fetch(
        `/api/wallet/${address}?chainId=${chain}${cursor ? "&cursor=" + encodeURIComponent(cursor) : ""}`,
        { signal: AbortSignal.any([signal, AbortSignal.timeout(25000)]) },
      );
      let data;
      try {
        data = await response.json();
      } catch {
        throw Error("This network could not be reached. Retry to continue.");
      }
      if (!response.ok && data.status === "indexed")
        throw Error("This network could not be checked. Retry to continue.");
      return data;
    },
    onChange: () => patchResults(),
  });
  const host = () => document.querySelector("[data-wallet-library]");
  const startVisible = () => {
    if (host() && !host().closest("[hidden]")) state.start();
  };
  window.addEventListener("hashchange", () => {
    cancelLookup();
    queueMicrotask(startVisible);
  });
  function lookupStatus(message = "", error = false, busy = false) {
    const form = host()?.querySelector("#wallet-lookup");
    const status = host()?.querySelector("[data-wallet-lookup-status]");
    if (status) {
      status.textContent = message;
      status.setAttribute("role", error ? "alert" : "status");
    }
    if (form) {
      form.querySelector("button").disabled = busy;
      form.querySelector("button").textContent = busy
        ? "Resolving name…"
        : "Find collected music";
    }
  }
  function cancelLookup() {
    lookupVersion++;
    lookupController?.abort();
    lookupController = null;
    lookupStatus();
  }
  function resolutionMarkup(address) {
    const resolved = resolvedNames.get(address);
    if (!resolved) return "";
    let source = "";
    try {
      const url = new URL(resolved.source);
      if (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        ["app.ens.domains", "ens.domains", "etherscan.io"].includes(
          url.hostname,
        )
      )
        source = url.href;
    } catch {}
    return `<p class="link-note">${esc(resolved.name)} → ${esc(address.slice(0, 8))}…${esc(address.slice(-6))}${source ? ` · <a href="${esc(source)}" target="_blank" rel="noopener noreferrer">ENS source ↗</a>` : ""}</p>`;
  }
  function results() {
    const snapshot = state.snapshot();
    if (!snapshot.address) return "";
    const byId = new Map(catalog().map((record) => [record.id, record]));
    return `<p class="link-note">${snapshot.automatic ? "Showing your linked wallet. " : ""}The first page on each network is checked automatically. More pages are loaded only when you choose them. Matches use the recovered catalog; a zero here does not establish that a wallet has no music NFTs.</p>${Object.entries(
      walletChains,
    )
      .map(([chain, name]) => {
        const s = snapshot.states.get(chain),
          loading = ["queued", "loading"].includes(s?.status);
        const recordIds = [
          ...new Set(
            (s?.items || [])
              .map((item) => item.recordId)
              .filter((id) => byId.has(id)),
          ),
        ];
        const heading =
          !s || s.status === "queued"
            ? "Waiting to check this network…"
            : s.status === "loading"
              ? "Checking this network…"
              : s.status === "error"
                ? "This network could not be checked"
                : `${s.items.length} token ${s.items.length === 1 ? "entry" : "entries"} checked · ${recordIds.length} archive ${recordIds.length === 1 ? "match" : "matches"}${s.nextCursor ? " · more pages available" : ""}`;
        return `<section class="section" data-wallet-network="${chain}"><div class="section-head"><div><h2>${name}</h2><p role="status">${heading}</p></div><button class="outline-button" data-wallet-chain="${chain}" ${loading ? "disabled" : ""}>${loading ? "Scanning…" : s?.status === "error" ? "Retry" : s?.nextCursor ? "Load next page" : s ? "Refresh" : "Scan network"}</button></div>${s?.error ? `<p class="notice" role="alert">${esc(s.error)}</p>` : ""}<div class="cards library-grid">${recordIds.map((id) => card(byId.get(id))).join("")}</div>${s?.status === "ready" ? `<p class="${recordIds.length ? "link-note" : "notice"}">${recordIds.length ? "Open a song to listen or add it to a playlist." : s.items.length ? "No recovered recordings matched the token entries checked so far." : "No token entries were returned on this page."} ${s.items.filter((item) => !item.recordId).length} token entries are not yet matched. ${s.nextCursor ? "More token entries remain; load the next page to continue." : "All pages returned by this index have been read."}</p>` : ""}</section>`;
      })
      .join("")}`;
  }
  function content() {
    const snapshot = state.snapshot(),
      address = snapshot.address || context.requested;
    return `<div class="intro"><div>${context.embedded ? "<h2>My collection</h2>" : "<h1>Your collected music</h1>"}<p>${snapshot.automatic ? "Explore your linked wallet’s music. No signature is needed to listen." : "Explore a public wallet’s music. No signature is needed to listen."}</p></div></div><form id="wallet-lookup"><label class="artist-search-label">Wallet address or ENS name<input name="address" placeholder="name.eth or 0x…" value="${esc(address)}" autocomplete="off" required></label><button class="outline-button">Find collected music</button></form><p class="link-note" data-wallet-lookup-status role="status"></p><div data-wallet-resolution>${resolutionMarkup(snapshot.address)}</div>${!snapshot.address && snapshot.accountId && !context.requested ? '<p class="notice">Link an Ethereum-compatible wallet above, or enter a public wallet to explore its music.</p>' : ""}<div data-wallet-results>${results()}</div>`;
  }
  function patchResults() {
    const target = host(),
      snapshot = state.snapshot();
    if (!target || target.dataset.walletAddress !== snapshot.address) return;
    const resultsNode = target.querySelector("[data-wallet-results]");
    if (!resultsNode) return;
    const y = scrollY;
    resultsNode.innerHTML = results();
    window.scrollTo({ top: y, behavior: "instant" });
  }
  function accountChanged(event) {
    const before = state.snapshot();
    state.setAccount(event.detail);
    if (state.snapshot().accountId !== before.accountId) cancelLookup();
    if (!host()) return;
    state.select(context.requested, context.embedded);
    const next = state.snapshot(),
      target = host();
    if (
      next.address !== before.address ||
      next.automatic !== before.automatic
    ) {
      cancelLookup();
      const y = scrollY;
      target.dataset.walletAddress = next.address;
      target.innerHTML = content();
      window.scrollTo({ top: y, behavior: "instant" });
    } else patchResults();
    startVisible();
  }
  document.addEventListener("mn:account-wallets", accountChanged);
  function view(address = "", embedded = false) {
    cancelLookup();
    context = { requested: address.trim(), embedded };
    state.select(context.requested, embedded);
    queueMicrotask(() => {
      const target = host();
      if (!target) return;
      document.dispatchEvent(new Event("mn:request-account-wallets"));
      startVisible();
    });
    return `<div data-wallet-library data-wallet-address="${esc(state.snapshot().address)}">${content()}</div>`;
  }
  function openAddress(address) {
    const next =
      (location.hash.startsWith("#me")
        ? "me?tab=collection&wallet="
        : "wallet/") + address;
    if (location.hash.slice(1).toLowerCase() === next.toLowerCase()) {
      const input = host()?.querySelector("#wallet-lookup input");
      if (input) input.value = address;
      const resolution = host()?.querySelector("[data-wallet-resolution]");
      if (resolution) resolution.innerHTML = resolutionMarkup(address);
      for (const chain of Object.keys(walletChains)) state.scan(chain);
    } else location.hash = next;
  }
  document.addEventListener("input", (event) => {
    if (event.target.closest("#wallet-lookup")) cancelLookup();
  });
  document.addEventListener("submit", async (event) => {
    if (event.target.id !== "wallet-lookup") return;
    event.preventDefault();
    cancelLookup();
    const form = event.target,
      input = form.querySelector('[name="address"]');
    const value = input.value.trim(),
      address = normalizeWallet(value);
    if (address) return openAddress(address);
    if (!value.includes(".") || value.length > 255 || /[\s/:?#@]/.test(value)) {
      lookupStatus(
        "Enter an Ethereum address or an ENS name, such as name.eth.",
        true,
      );
      return;
    }
    const version = lookupVersion,
      route = location.hash,
      accountId = state.snapshot().accountId;
    const controller = new AbortController();
    lookupController = controller;
    const current = () =>
      version === lookupVersion &&
      form.isConnected &&
      form === host()?.querySelector("#wallet-lookup") &&
      location.hash === route &&
      state.snapshot().accountId === accountId &&
      input.value.trim() === value;
    lookupStatus(`Resolving ${value}…`, false, true);
    try {
      const response = await fetch(
        "/api/wallet/resolve?name=" + encodeURIComponent(value),
        {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(20000),
          ]),
        },
      );
      let result;
      try {
        result = await response.json();
      } catch {
        throw Error("ENS could not be reached. Please retry.");
      }
      if (!current()) return;
      const resolved = normalizeWallet(result.address);
      if (!response.ok || result.status !== "resolved" || !resolved)
        throw Error(
          result.message || "This name did not resolve to an Ethereum address.",
        );
      resolvedNames.set(resolved, {
        name: result.name || value,
        source: result.source,
        checkedAt: result.checkedAt,
      });
      lookupStatus();
      openAddress(resolved);
    } catch (error) {
      if (current())
        lookupStatus(
          error.name === "TimeoutError"
            ? "ENS took too long to respond. Please retry."
            : error.message || "ENS could not be reached. Please retry.",
          true,
        );
    } finally {
      if (current()) {
        lookupController = null;
        const button = form.querySelector("button");
        button.disabled = false;
        button.textContent = "Find collected music";
      }
    }
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-wallet-chain]");
    if (button) state.scan(button.dataset.walletChain);
  });
  return { view };
}
