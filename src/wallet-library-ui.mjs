import {
  collectionSelect,
  filterCollectionRecords,
} from "./collection-filters.mjs";
import {
  createWalletLibraryState,
  walletChains,
  normalizeWallet,
} from "./wallet-library-state.mjs";

export function mountWalletLibrary({
  esc,
  catalog,
  card,
  platform = (r) => r.platform || "",
  onCollectionChange = () => {},
}) {
  let context = { requested: "", embedded: false };
  let ownedRequested = false,
    visibleLimit = 40;
  const filters = {
    query: "",
    platform: "",
    network: "",
    media: "",
    collection: "",
    sort: "archive",
  };
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
    onChange: () => {
      patchResults();
      onCollectionChange(state.ownedSnapshot());
    },
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
    const ids = new Set(
      [...snapshot.states.values()]
        .flatMap((s) => (s?.items || []).map((item) => item.recordId))
        .filter(Boolean),
    );
    const matched = catalog().filter((record) => ids.has(record.id));
    const filtered = filterCollectionRecords(matched, filters, platform);
    const select = (name, label, choices) =>
      collectionSelect(
        esc,
        name,
        label,
        choices,
        filters[name],
        "data-wallet-filter",
      );
    const controls = `<label class="artist-search-label">Search collected music<input type="search" data-wallet-filter="query" value="${esc(filters.query)}" placeholder="Artist, song, or collection…"></label><div class="filter-toolbar">${select("platform", "Platform", [["", "All platforms"], ...[...new Set(matched.map(platform).filter(Boolean))].sort().map((name) => [name, name])])}${select("network", "Network", [["", "All networks"], ...Object.entries(walletChains)])}${select("collection", "Collection", [["", "All collections"], ...[...new Set(matched.map((r) => r.collection).filter(Boolean))].sort().map((name) => [name, name])])}${select(
      "media",
      "Media",
      [
        ["", "All media"],
        ["audio", "Audio"],
        ["video", "Video"],
      ],
    )}${select("sort", "Sort", [
      ["archive", "Featured order"],
      ["title", "Title A–Z"],
      ["artist", "Artist A–Z"],
      ["newest", "Newest first"],
      ["oldest", "Oldest first"],
    ])}</div><div class="section-head"><p class="link-note">${filtered.length} of ${matched.length} recovered recordings matched in loaded wallet pages</p><button class="text-button" data-wallet-reset-filters>Reset filters</button></div><div class="cards library-grid" data-wallet-matches>${filtered.slice(0, visibleLimit).map(card).join("")}</div>${filtered.length > visibleLimit ? '<button class="outline-button more" data-wallet-more>Load more recordings</button>' : ""}`;
    return `${controls}<p class="link-note">${snapshot.linked.includes(snapshot.address) ? "Showing your linked wallet. " : ""}The first page on each network is checked automatically. More pages are loaded only when you choose them. Matches use the recovered catalog; a zero here does not establish that a wallet has no music NFTs.</p>${Object.entries(
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
        return `<section class="section" data-wallet-network="${chain}"><div class="section-head"><div><h2>${name}</h2><p role="status">${heading}</p></div><button class="outline-button" data-wallet-chain="${chain}" ${loading ? "disabled" : ""}>${loading ? "Scanning…" : s?.status === "error" ? "Retry" : s?.nextCursor ? "Load next page" : s ? "Refresh" : "Scan network"}</button></div>${s?.error ? `<p class="notice" role="alert">${esc(s.error)}</p>` : ""}${s?.status === "ready" ? `<p class="${recordIds.length ? "link-note" : "notice"}">${recordIds.length ? "Open a song to listen or add it to a playlist." : s.items.length ? "No recovered recordings matched the token entries checked so far." : "No token entries were returned on this page."} ${s.items.filter((item) => !item.recordId).length} token entries are not yet matched. ${s.nextCursor ? "More token entries remain; load the next page to continue." : "All pages returned by this index have been read."}</p>` : ""}</section>`;
      })
      .join("")}`;
  }
  function content() {
    const snapshot = state.snapshot(),
      address = snapshot.address || context.requested;
    return `<div class="intro"><div>${context.embedded ? "<h2>My collection</h2>" : "<h1>Your collected music</h1>"}<p>${snapshot.linked.includes(snapshot.address) ? "Explore your linked wallet’s music. No signature is needed to listen." : "Explore a public wallet’s music. No signature is needed to listen."}</p></div></div>${
      snapshot.linked.length > 1
        ? collectionSelect(
            esc,
            "address",
            "Linked wallet",
            [
              ["", "Choose a linked wallet"],
              ...snapshot.linked.map((address) => [
                address,
                address.slice(0, 8) + "…" + address.slice(-6),
              ]),
            ],
            snapshot.linked.includes(snapshot.address) ? snapshot.address : "",
            "data-linked-wallet",
          )
        : ""
    }<form id="wallet-lookup"><label class="artist-search-label">Ethereum-compatible wallet address or ENS name<input name="address" placeholder="name.eth or 0x…" value="${esc(address)}" autocomplete="off" required></label><button class="outline-button">Find collected music</button></form><p class="link-note" data-wallet-lookup-status role="status"></p><div data-wallet-resolution>${resolutionMarkup(snapshot.address)}</div>${!snapshot.address && snapshot.accountId && !context.requested ? '<p class="notice">Link an Ethereum-compatible wallet above, or enter a public wallet to explore its music.</p>' : ""}<p class="link-note">Solana wallet-owned Nina collections are not available yet. Nina recordings can still be found in Explore and added to playlists.</p><div data-wallet-results>${results()}</div>`;
  }
  function patchResults() {
    const target = host(),
      snapshot = state.snapshot();
    if (!target || target.dataset.walletAddress !== snapshot.address) return;
    const resultsNode = target.querySelector("[data-wallet-results]");
    if (!resultsNode) return;
    const y = scrollY;
    const active = document.activeElement,
      field = active?.dataset.walletFilter;
    const selection =
      field === "query" ? [active.selectionStart, active.selectionEnd] : null;
    resultsNode.innerHTML = results();
    if (field) {
      const replacement = resultsNode.querySelector(
        `[data-wallet-filter="${field}"]`,
      );
      replacement?.focus({ preventScroll: true });
      if (selection) replacement?.setSelectionRange(...selection);
    }
    window.scrollTo({ top: y, behavior: "instant" });
  }
  function accountChanged(event) {
    const before = state.snapshot();
    state.setAccount(event.detail);
    if (state.snapshot().accountId !== before.accountId) cancelLookup();
    onCollectionChange(state.ownedSnapshot());
    if (ownedRequested) state.startLinked();
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
    if (ownedRequested) state.startLinked();
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
    if (event.target.dataset.walletFilter === "query") {
      filters.query = event.target.value;
      visibleLimit = 40;
      patchResults();
    }
  });
  document.addEventListener("change", (event) => {
    const key = event.target.dataset.walletFilter;
    if (key && Object.hasOwn(filters, key)) {
      filters[key] = event.target.value;
      visibleLimit = 40;
      patchResults();
    }
    if (
      event.target.hasAttribute("data-linked-wallet") &&
      normalizeWallet(event.target.value)
    )
      openAddress(event.target.value);
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
    if (event.target.closest("[data-wallet-reset-filters]")) {
      Object.assign(filters, {
        query: "",
        platform: "",
        network: "",
        media: "",
        collection: "",
        sort: "archive",
      });
      visibleLimit = 40;
      patchResults();
    }
    if (event.target.closest("[data-wallet-more]")) {
      visibleLimit += 40;
      patchResults();
    }
    const button = event.target.closest("[data-wallet-chain]");
    if (button) state.scan(button.dataset.walletChain);
  });
  return {
    view,
    ownedSnapshot: () => state.ownedSnapshot(),
    startOwned() {
      ownedRequested = true;
      document.dispatchEvent(new Event("mn:request-account-wallets"));
      state.startLinked();
    },
    stopOwned() {
      ownedRequested = false;
    },
  };
}
