import {
  isIndexedRelease,
  unsupportedIndexedRead,
  isSolanaAsset,
  unsupportedSolanaRead,
} from "./asset-capabilities.mjs";
export function mountCollectors({
  esc,
  short,
  date,
  explorers,
  chainNames,
  catalog,
  recordLink,
  collectionView = () => "",
  rerender,
}) {
  const states = new Map(),
    profiles = new Map(),
    pendingProfiles = new Map();
  let activeRecord = null,
    activeProfile = null;
  const walletLink = (a) => "#collector/" + a.toLowerCase();
  function identity(h) {
    const p = profiles.get(h.address.toLowerCase());
    return {
      name: p?.name || h.archived?.name || short(h.address),
      avatar: p?.avatarURL || h.archived?.localAvatar || null,
      source:
        p?.avatarSource ||
        (h.archived ? "Sound · " + h.archived.capturedAt : "Wallet"),
      p,
    };
  }
  function avatar(h, cls = "") {
    const i = identity(h),
      letters =
        h.archived?.name
          ?.split(/\s+/)
          .map((x) => x[0])
          .slice(0, 2)
          .join("") || h.address.slice(2, 4).toUpperCase();
    return `<span class="collector-avatar ${cls}" style="--wallet-hue:${parseInt(h.address.slice(2, 8), 16) % 360}" aria-hidden="true"><span>${esc(letters)}</span>${i.avatar ? `<img src="${esc(i.avatar)}" alt="" loading="lazy" onerror="this.remove()">` : ""}</span>`;
  }
  function row(h, purchased = false) {
    const i = identity(h);
    return `<a class="collector-card" href="${walletLink(h.address)}" title="${esc(h.address)}">${avatar(h)}<span class="collector-name">${esc(i.name)}<small>${esc(i.source)}</small></span><span class="collector-editions">${esc(h.balance)}<small>${purchased ? "purchased" : h.balance === "1" ? "edition" : "editions"}</small></span></a>`;
  }
  function content(r, full = false) {
    if (isIndexedRelease(r))
      return `<div class="reading"><h2>Collectors not yet linked</h2><p>${esc(unsupportedIndexedRead().message)}</p></div>`;
    if (isSolanaAsset(r))
      return `<div class="reading"><h2>Solana collectors</h2><p>${esc(unsupportedSolanaRead().message)}</p></div>`;
    if (r.standard === "ERC20")
      return '<div class="reading"><h2>Coin holders</h2><p>This release is a Zora content coin. NFT edition collectors do not apply; coin-holder recovery has not been added yet.</p></div>';
    const s = states.get(r.id);
    if (!s || (s.loading && !s.items.length))
      return '<div class="collector-loading"><span class="status-dot"></span> Recovering the people behind this record…</div>';
    if (s.error && !s.items.length)
      return `<div class="collector-loading">Collector data is temporarily unavailable. <button class="text-button" data-retry-collectors="${r.id}">Retry ↻</button></div>`;
    const title =
      s.scope === "spinamp-release-snapshot"
        ? "Indexed collectors"
        : s.scope === "catalog-purchases"
          ? "Collectors in purchase history"
          : s.scope === "catalog-snapshot"
            ? "Collectors in Catalog’s snapshot"
            : [
                  "release",
                  "legacy-release",
                  "media-release",
                  "token-edition",
                ].includes(s.scope)
              ? "Collectors"
              : "Featured edition holder";
    const items = full ? s.items : s.items.slice(0, 8);
    return `<div class="section-head"><div><h2>${title}</h2><p>${s.scope === "spinamp-release-snapshot" ? `${s.items.length} wallets · ${s.mappedTokenCount} mapped editions · ${chainNames[r.chainId]}` : ["catalog-snapshot", "catalog-purchases"].includes(s.scope) ? `${s.items.length} wallets · ${chainNames[r.chainId]} · March 9, 2026` : ["release", "legacy-release", "media-release", "token-edition"].includes(s.scope) ? `${s.items.length}${s.nextCursor ? " +" : ""} wallets ${s.nextCursor ? "loaded" : "in this indexed snapshot"} · ${chainNames[r.chainId]}` : `Token ${esc(r.tokenId)} · release-wide recovery still needed`}</p></div>${!full ? `<a class="text-button" href="${recordLink(r)}?tab=collectors">View collectors ↗</a>` : ""}</div><div class="${full ? "collector-grid" : "collector-preview"}">${items.map((h) => row(h, s.scope === "catalog-purchases")).join("") || (s.nextCursor ? '<p class="link-note">More tokens remain to be checked for this release.</p>' : '<p class="link-note">No holders returned in this snapshot.</p>')}</div>${
      full
        ? `<p class="link-note">${s.scope === "spinamp-release-snapshot" ? "Spinamp indexed balances for the editions explicitly linked to this recording, with the same original metadata reference. The index’s update time is unknown; these are not independently verified current balances or original minters." : s.scope === "catalog-purchases" ? "Wallets that received this token through purchases recorded in Catalog’s March 9, 2026 export. Quantities show purchased copies, not current holdings. The exported Base transfers omit mint history, so they cannot establish complete wallet balances." : s.scope === "catalog-snapshot" ? "Historical token balances from Catalog’s official March 9, 2026 export. Ethereum uses the exported token owner; Base balances are reconstructed from exported transfer events. These are not live wallet balances." : s.scope === "token-edition" ? `Current indexed holders of token ${esc(r.tokenId)} only. Other tokens in this contract are excluded. Balances are reported by Blockscout and are not necessarily original mints.` : s.scope === "media-release" ? "Current indexed owners of editions whose original media content address matches this recording. Tokens with other media or missing metadata are excluded. This is a media-matched index snapshot, not an independently verified census or a list of original minters." : ["release", "legacy-release"].includes(s.scope) ? "Current holders of tokens mapped to this release, reported by Blockscout. Legacy artist contracts are filtered by their onchain edition IDs. These are not necessarily the original minters." : "This contract is not yet mapped to a single release. Only the selected token owner is shown; other contract holders are not attributed to this song."} ${s.snapshotDate ? `Snapshot date: ${esc(s.snapshotDate)}` : `Checked ${date(s.checkedAt)}`}. ${s.deployment ? `<a href="${explorers[r.chainId]}/tx/${s.deployment.transaction}" target="_blank" rel="noopener noreferrer">Release factory event ↗</a>` : ""} ${s.source?.startsWith("https:") ? `<a href="${esc(s.source)}" target="_blank" rel="noopener noreferrer">Holder source ↗</a>` : ""}</p>${
            s.purchases?.length
              ? `<details class="artist-sources"><summary>Purchases preserved in the snapshot (${s.purchases.length})</summary>${s.purchases
                  .slice(0, 50)
                  .map(
                    (p) =>
                      `<p><a href="${walletLink(p.recipient)}">${esc(short(p.recipient))}</a> received ${esc(p.amount)} · <a href="${explorers[r.chainId]}/tx/${esc(p.transaction)}" target="_blank" rel="noopener noreferrer">Purchase transaction ↗</a></p>`,
                  )
                  .join("")}</details>`
              : ""
          }${s.nextCursor ? `<button class="outline-button" data-more-collectors="${r.id}" ${s.loading ? "disabled" : ""}>${s.loading ? "Loading…" : "Load more collectors"}</button>` : ""}${s.error ? '<p class="link-note">The next page failed. Loaded collectors are retained; you can retry.</p>' : ""}`
        : ""
    }`;
  }
  function panel(r, full = false) {
    return `<section class="song-collectors ${full ? "full" : ""}" data-collector-panel="${r.id}" data-full="${full}">${content(r, full)}</section>`;
  }
  function refresh(id) {
    const r = catalog().find((r) => r.id === id);
    if (!r) return;
    document.querySelectorAll("[data-collector-panel]").forEach((el) => {
      if (el.dataset.collectorPanel === id)
        el.innerHTML = content(r, el.dataset.full === "true");
    });
  }
  async function getProfile(address) {
    address = address.toLowerCase();
    if (profiles.has(address)) return profiles.get(address);
    if (pendingProfiles.has(address)) return pendingProfiles.get(address);
    const task = fetch("/api/collector/" + address)
      .then(async (r) => {
        if (!r.ok) throw Error();
        const p = await r.json();
        profiles.set(address, p);
        return p;
      })
      .finally(() => pendingProfiles.delete(address));
    pendingProfiles.set(address, task);
    return task;
  }
  async function enrich(id) {
    const s = states.get(id);
    if (!s) return;
    const items = s.items.slice(
      0,
      document.querySelector('[data-full="true"]') ? 100 : 12,
    );
    let idx = 0;
    await Promise.all(
      Array.from({ length: 3 }, async () => {
        while (idx < items.length) {
          const h = items[idx++];
          try {
            await getProfile(h.address);
            if (activeRecord === id) refresh(id);
          } catch {}
        }
      }),
    );
  }
  async function load(id, more = false, emptyPages = 0) {
    const record = catalog().find((r) => r.id === id);
    if (
      isIndexedRelease(record) ||
      isSolanaAsset(record) ||
      record?.standard === "ERC20"
    )
      return;
    activeRecord = id;
    const prior = states.get(id);
    if (prior?.loading) return;
    if (prior?.items.length && !more && !prior.error) {
      refresh(id);
      enrich(id);
      return;
    }
    const state = prior || { items: [] };
    state.loading = true;
    state.error = false;
    states.set(id, state);
    refresh(id);
    try {
      const res = await fetch(
        "/api/collectors/" +
          encodeURIComponent(id) +
          (more && state.nextCursor
            ? "?cursor=" + encodeURIComponent(state.nextCursor)
            : ""),
      );
      const d = await res.json();
      if (!res.ok || d.status !== "indexed") throw Error();
      const merged = new Map(
        (more ? state.items : []).map((h) => [h.address.toLowerCase(), h]),
      );
      d.items.forEach((h) => {
        const key = h.address.toLowerCase(),
          prior = merged.get(key);
        if (h.tokenIds && prior?.tokenIds) {
          h.tokenIds = [...new Set([...prior.tokenIds, ...h.tokenIds])];
          h.balance = String(h.tokenIds.length);
        }
        merged.set(key, h);
      });
      Object.assign(state, d, {
        items: [...merged.values()],
        loading: false,
        error: false,
      });
      refresh(id);
      if (!state.items.length && state.nextCursor && emptyPages < 8) {
        await load(id, true, emptyPages + 1);
        return;
      }
      enrich(id);
    } catch {
      state.error = true;
      state.loading = false;
      refresh(id);
    }
  }
  function profilePage(address) {
    if (!/^0x[0-9a-f]{40}$/i.test(address))
      return "<h1>Collector not found</h1>";
    activeProfile = address.toLowerCase();
    const p = profiles.get(activeProfile);
    const h = { address, archived: p?.archived };
    return `<a class="back" href="#explore">← Explore music</a><section class="collector-profile"><div>${avatar(h, "large")}<small class="avatar-caption">${esc(p?.avatarSource || "Wallet placeholder")}</small></div><div><span class="eyebrow">COLLECTOR PROFILE</span><h1>${esc(p?.name || short(address))}</h1><code>${esc(address)}</code>${p?.archived ? `<p class="link-note">On Sound: ${esc(p.archived.name)} · captured ${esc(p.archived.capturedAt)}</p>` : ""}<p class="link-note">${p?.ens?.status === "verified" ? "ENS name verified against this wallet." : p?.archived ? "Name preserved from the historical Sound profile." : "A public wallet profile. Identity details have not been recovered yet."}</p><div class="artist-links">${p?.ens?.status === "verified" ? `<a class="outline-button" href="${esc(p.ens.source)}" target="_blank" rel="noopener noreferrer">Current ENS profile ↗</a>` : ""}${p?.archived ? `<a class="outline-button" href="${esc(p.archived.source)}" target="_blank" rel="noopener noreferrer">Sound capture · ${esc(p.archived.capturedAt)} ↗</a>` : ""}<a class="outline-button" href="https://etherscan.io/address/${address}" target="_blank" rel="noopener noreferrer">Wallet explorer ↗</a></div>${!p ? '<p class="link-note" id="profile-loading">Resolving wallet identity and historical profile…</p>' : p.ens?.status === "unavailable" ? '<p class="link-note">ENS lookup is temporarily unavailable. Historical information remains visible. <button class="text-button" data-retry-profile>Retry ENS ↻</button></p>' : ""}</div></section>${collectionView(address)}${p ? `${p.observedHoldings?.length || p.snapshotHoldings?.length ? `<details class="artist-sources"><summary>Historical collection observations and sources</summary><p class="link-note">Previously observed release-holder pages and recovered index snapshots. Historical purchases and ownership observations do not establish current holdings.</p><div class="collector-holdings">${[...(p.observedHoldings || []), ...(p.snapshotHoldings || [])].map((r) => `<a class="collector-record" href="${recordLink(r)}"><div><strong>${esc(r.title)}</strong><small>${esc(r.artist)} · ${esc(chainNames[r.chainId] || r.chainId)}${r.scope ? " · " + esc(r.scope) : ""}</small></div><span>Listen ↗</span></a>`).join("")}</div></details>` : ""}${p.comments?.length ? `<div class="section-head"><h2>Words left on Sound</h2><span class="tag">Historical web captures</span></div><div class="comments">${p.comments.map((c) => `<article class="comment"><small>${esc(c.release)} · edition ${esc(c.serialNumber)}</small><p>${esc(c.comment.message)}</p></article>`).join("")}</div>` : ""}` : ""}`;
  }
  async function loadProfile(address) {
    if (!/^0x[0-9a-f]{40}$/i.test(address)) return;
    activeProfile = address.toLowerCase();
    try {
      await getProfile(address);
      if (location.hash.toLowerCase() === "#collector/" + activeProfile)
        rerender();
    } catch {
      const el = document.querySelector("#profile-loading");
      if (el)
        el.innerHTML =
          'Profile lookup unavailable. <button class="text-button" data-retry-profile>Retry ↻</button>';
    }
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.moreCollectors) load(b.dataset.moreCollectors, true);
    if (b.dataset.retryCollectors) load(b.dataset.retryCollectors);
    if ("retryProfile" in b.dataset) {
      profiles.delete(activeProfile);
      loadProfile(activeProfile);
    }
  });
  return {
    panel,
    load,
    profilePage,
    loadProfile,
    hasProfile: (address) => profiles.has(address?.toLowerCase()),
  };
}
