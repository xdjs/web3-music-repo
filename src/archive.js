import { musicFacts } from "./music-facts.mjs";
import { mountWalletLibrary } from "./wallet-library-ui.mjs";
import { mountCollectors } from "./collectors-ui.mjs";
import { createMediaRecovery } from "./media-recovery.js";
import { mountPlaylists } from "./personal-playlists.mjs";
import { chainNames, explorers, sourceKind } from "./recovery-model.mjs";
const $ = (s) => document.querySelector(s),
  main = $("#main");
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const short = (s) => (s ? `${s.slice(0, 6)}…${s.slice(-4)}` : "");
const slug = (s) =>
  String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const cleanTitle = (s) => s.replace(/\s*#\d+$/, "");
const time = (s) =>
  Number.isFinite(s)
    ? Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0")
    : "0:00";
const date = (s) =>
  s
    ? new Date(s).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Not checked";
let coverage = null,
  artistLimit = 48,
  artistQuery = "",
  ledgerLimit = 100;
let catalog = [],
  people = [],
  summary = {},
  archive = null,
  filter = "All",
  facets = { network: "", media: "", sort: "archive", collection: "" },
  moreFilters = false,
  query = "",
  limit = 40,
  current = null,
  queue = [],
  queueIndex = 0,
  tab = "about",
  ownerCache = new Map(),
  renderVersion = 0,
  playVersion = 0,
  toastTimer;
let likes = new Set();
try {
  likes = new Set(JSON.parse(localStorage.getItem("mn-archive-likes") || "[]"));
  document.documentElement.dataset.theme =
    localStorage.getItem("mn-archive-theme") || "light";
} catch {}
const personalPlaylists = mountPlaylists({
  catalog: () => catalog,
  esc,
  image: (r) => image(r),
  play: (...args) => play(...args),
  notify,
  rerender: () => route(),
});
const collectors = mountCollectors({
  esc,
  short,
  date,
  explorers,
  chainNames,
  catalog: () => catalog,
  recordLink,
  rerender: () => route(),
});
const audio = $("#audio");
audio.volume = 0.8;
const preferred = [
  "record-69c77ef0",
  "record-not4me",
  "record-e6516778",
  "record-28b708ee",
  "record-b31b7bac",
  "park-sound-rainwater",
  "record-00396a23",
];
const featuredArtists = [
  "pete-rango",
  "daniel-allan",
  "latasha",
  "iman-europe",
  "jamee-cornelia",
  "sound-of-fractures",
  "the-park",
];
const artistId = (r) => r.artistId || slug(r.artist);
const sound = (r) =>
  r.platform === "Sound" || r.originalRelease?.includes("sound.xyz");
const platform = (r) =>
  sound(r)
    ? "Sound"
    : r.platform === "Unconfirmed"
      ? "Unconfirmed"
      : r.platform || "Other";
const image = (r) =>
  r.id === "record-69c77ef0"
    ? "/media/record-69c77ef0-1500.webp"
    : r.recovery?.localImage || r.recovery?.imageURL || r.imageURL || "";
const portrait = (id) => person(id).portrait?.src || "";
function portraitMarkup(id, lazy = false) {
  const p = person(id);
  return p.portrait
    ? `<img src="${esc(p.portrait.src)}" alt="${esc(p.portrait.alt || p.name)}" ${lazy ? 'loading="lazy"' : ""}>`
    : `<span class="artist-placeholder" aria-label="${esc(p.name)} profile image not recovered">${esc(
        p.name
          .split(/\s+/)
          .map((s) => s[0])
          .slice(0, 2)
          .join(""),
      )}</span>`;
}
function notify(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 4500);
}
function recordLink(r) {
  return "#record/" + encodeURIComponent(r.id);
}
function img(r, cls = "") {
  return image(r)
    ? `<img class="${cls}" src="${esc(image(r))}" alt="${esc(cleanTitle(r.title))} artwork" loading="lazy">`
    : `<span class="cover-fallback">♫</span>`;
}
function card(r) {
  return `<article class="record-card"><div class="cover"><a href="${recordLink(r)}" aria-label="Open ${esc(r.title)}">${img(r)}</a><span class="cover-badge">${esc(platform(r))}</span>${r.kind !== "artwork" ? `<button class="cover-play" data-play="${esc(r.id)}" aria-label="Play ${esc(r.title)}">▶</button>` : ""}</div><h3><a href="${recordLink(r)}">${esc(cleanTitle(r.title))}</a></h3><div class="card-meta"><a href="#artist/${esc(artistId(r))}">${esc(r.artist)}</a><button class="icon heart ${likes.has(r.id) ? "active" : ""}" data-like="${esc(r.id)}" aria-label="${likes.has(r.id) ? "Unlike" : "Like"} ${esc(r.title)}">${likes.has(r.id) ? "♥" : "♡"}</button></div></article>`;
}
function artistRecords(id) {
  return catalog.filter(
    (r) =>
      artistId(r) === id ||
      r.personIds?.includes(id) ||
      r.credits?.some((c) => c.personId === id),
  );
}
function person(id) {
  return (
    people.find((p) => p.id === id) || {
      id,
      name: catalog.find((r) => artistId(r) === id)?.artist || id,
      bio: "",
    }
  );
}
function artistCard(id) {
  const p = person(id),
    n = artistRecords(id).length;
  return `<a class="artist-card" href="#artist/${esc(id)}">${portraitMarkup(id, true)}<strong>${esc(p.name)}</strong><small>${n} ${id === "pete-rango" ? "credited recordings" : "in the archive"}</small></a>`;
}
function home() {
  const hero = catalog.find((r) => r.id === preferred[0]),
    picks = preferred
      .slice(1, 6)
      .map((id) => catalog.find((r) => r.id === id))
      .filter(Boolean);
  return `<div class="intro"><div><h1>The music remains.</h1><p>A living archive of the music NFT era. Follow the records. Press play.</p></div><span class="live-note"><i class="status-dot"></i> Recovery in progress</span></div><section class="hero" aria-label="Featured recording"><img class="hero-bg" src="${esc(image(hero))}" alt=""><div class="hero-copy"><span class="eyebrow"><i class="status-dot"></i> RECOVERED FROM ETHEREUM + ARWEAVE</span><h2>MIAMI<br>FREESTYLE</h2><p class="artist">CAMPFIRE · Aly, Tarot, Elle Symone, Early & TK</p><div class="hero-actions"><button class="primary" data-play="${hero.id}">▶ &nbsp; Listen now</button><a class="hero-proof" href="${recordLink(hero)}?tab=proof">Follow the onchain record ↗</a></div></div><div class="hero-credit"><span>PEOPLE BEHIND THE RECORD</span><a href="#artist/pete-rango"><div>Pete Rango<small>Mixing & mastering</small></div><img src="/people/pete-rango-160.webp" alt=""></a><a href="#artist/abjo"><div>AbJo<small>Production</small></div>${portrait("abjo") ? `<img src="${esc(portrait("abjo"))}" alt="">` : '<span class="credit-initial" aria-hidden="true">A</span>'}</a></div><img class="hero-waveform" src="/recovered/miami-waveform.svg" alt="Waveform derived from the recovered MIAMI FREESTYLE audio"><div class="hero-bottom"><span>◈ Ethereum &nbsp; → &nbsp; Arweave metadata &nbsp; → &nbsp; Original audio</span><span>The platform went offline.<br>The record is still here.</span></div></section><div class="proof-strip"><span><b>${summary.catalogued}</b> records catalogued &nbsp; · &nbsp; <b>${summary.readable}</b> metadata reads recovered</span><span>${summary.chains.join(" · ")}</span><a href="#recovery">Explore the evidence ↗</a></div><section class="section"><div class="section-head"><div><h2>Back in rotation</h2><p>Original music, recovered through its tokens.</p></div><a class="text-button" href="#explore">Explore all ↗</a></div><div class="cards home-cards">${picks.map(card).join("")}</div></section><section class="section"><div class="section-head"><div><h2>The people who made the era</h2><p>Artists, collaborators, and the work that connects them.</p></div><a class="text-button" href="#artists">Meet everyone ↗</a></div><div class="artist-grid">${featuredArtists.map(artistCard).join("")}</div></section><div class="archive-callout"><div class="archive-symbol">◈</div><div><h3>A platform can disappear. A record can survive.</h3><p>We read the original contracts and follow their metadata to the music. Every recording has a trail you can inspect. Web-archived memories are labeled separately.</p></div><a class="outline-button" href="#recovery">How recovery works ↗</a></div>`;
}
function explore(onlyLikes = false) {
  let list = catalog.filter(
    (r) =>
      (!onlyLikes || likes.has(r.id)) &&
      (filter === "All" ||
        (filter === "Other platforms"
          ? !["Sound", "Catalog", "Zora"].includes(platform(r))
          : platform(r) === filter)) &&
      (!facets.network || String(r.chainId) === facets.network) &&
      (!facets.media || r.kind === facets.media) &&
      (!facets.collection || r.collection === facets.collection),
  );
  if (query) {
    const q = query.toLowerCase();
    list = list.filter((r) =>
      [r.title, r.artist, ...(r.personIds || []).map((id) => person(id).name)]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }
  if (facets.sort !== "archive")
    list.sort(
      (a, b) =>
        (facets.sort === "artist"
          ? a.artist.localeCompare(b.artist)
          : cleanTitle(a.title).localeCompare(cleanTitle(b.title))) ||
        a.id.localeCompare(b.id),
    );
  const select = (name, label, choices) =>
    `<label class="filter-control"><span>${label}</span><select data-facet="${name}" aria-label="${label}">${choices.map(([value, text]) => `<option value="${esc(value)}" ${facets[name] === String(value) ? "selected" : ""}>${esc(text)}</option>`).join("")}</select></label>`;
  const controls = `<div class="filter-toolbar">${select("network", "Network", [["", "All networks"], ...Object.entries(chainNames).filter(([id]) => catalog.some((r) => String(r.chainId) === id))])}${select(
    "media",
    "Media",
    [
      ["", "All media"],
      ["audio", "Audio"],
      ["video", "Video"],
      ["artwork", "Artwork"],
    ],
  )}${select("sort", "Sort", [
    ["archive", "Archive order"],
    ["title", "Title A–Z"],
    ["artist", "Artist A–Z"],
  ])}<details class="more-filters" ${moreFilters ? "open" : ""}><summary>More filters${facets.collection ? " · 1" : ""}</summary>${select("collection", "Collection", [["", "All collections"], ...[...new Set(catalog.map((r) => r.collection).filter(Boolean))].sort().map((c) => [c, c])])}</details><button class="text-button" data-clear-filters>Clear filters</button></div>`;
  return `<div class="intro"><div><h1>${onlyLikes ? "Liked sounds" : query ? "Search the archive" : "Explore the archive"}</h1><p>${onlyLikes ? "Your selections, saved in this browser." : query ? `Results for “${esc(query)}”` : "A growing catalog across Sound, Catalog, Zora, and beyond."}</p></div></div><div class="filters">${["All", "Sound", "Catalog", "Zora", "Other platforms"].map((f) => `<button class="chip ${filter === f ? "active" : ""}" data-filter="${f}" aria-pressed="${filter === f}">${f}</button>`).join("")}<span class="results">${list.length.toLocaleString()} records</span></div>${controls}${list.length ? `<div class="cards library-grid">${list.slice(0, limit).map(card).join("")}</div>${list.length > limit ? '<button class="outline-button more" data-more>Load more recordings</button>' : ""}` : `<div class="empty"><h2>${onlyLikes ? "Make yourself a collection." : "No recordings found."}</h2>${onlyLikes ? "Tap the heart on any recording to keep it here." : "Try another artist, title, or platform."}</div>`}`;
}
function artists() {
  const ids = [
    ...new Set([...featuredArtists, ...catalog.map(artistId)]),
  ].filter(
    (id) =>
      artistRecords(id).length &&
      (!artistQuery ||
        person(id).name.toLowerCase().includes(artistQuery.toLowerCase())),
  );
  return `<div class="intro"><div><h1>Artists & collaborators</h1><p>The people behind the records. Credits are preserved where documented.</p></div></div><label class="artist-search-label">Find an artist<input id="artist-search" type="search" placeholder="Search artist names…" value="${esc(artistQuery)}"></label><p class="link-note">${ids.length} artists and collaborators</p><div class="artist-grid section">${ids.slice(0, artistLimit).map(artistCard).join("")}</div>${ids.length > artistLimit ? '<button class="outline-button more" data-more-artists>Load more artists</button>' : ""}`;
}
function artistLinks(p) {
  return `${p.portrait ? `<a class="link-note" href="${esc(p.portrait.source)}" target="_blank" rel="noopener noreferrer">Image: ${esc(p.portrait.credit)} ↗</a>` : ""}<div class="artist-links">${(p.links || []).map((l) => `<a class="outline-button" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)} ↗</a>${l.source ? `<a class="link-note" href="${esc(l.source)}" target="_blank" rel="noopener noreferrer">${esc(l.capturedAt)} source ↗</a>` : ""}`).join("")}</div>${p.links?.length ? '<small class="link-note">Links preserved from research or archived artist profiles; current account ownership has not been reverified.</small>' : ""}${p.sources?.length ? `<details class="artist-sources"><summary>Artist sources & historical context (${p.sources.length})</summary>${p.sources.map((s) => `<p><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a><small>${esc(s.kind)} · ${esc(s.date)}</small></p>`).join("")}</details>` : ""}`;
}
function artistPage(id) {
  const p = person(id),
    list = artistRecords(id);
  return `<a class="back" href="#artists">← All artists & collaborators</a><section class="artist-identity ${p.banner ? "has-banner" : ""}">${p.banner ? `<img class="artist-banner" src="${esc(p.banner.src)}" alt="${esc(p.name)} historical profile banner">` : ""}<div class="artist-identity-row"><div class="artist-identity-avatar">${portraitMarkup(id)}</div><div class="artist-identity-name"><span class="eyebrow">${id === "pete-rango" ? "PRODUCER · MIXING · MASTERING" : esc(p.kind || "Artist")}</span><h1>${esc(p.name)}</h1></div><div class="artist-stat"><strong>${list.length}</strong><span>Recovered recordings</span></div></div><div class="artist-identity-bio"><p>${esc(p.bio || "Artist attribution preserved from the recovered recordings.")}</p>${p.banner ? `<a class="link-note" href="${esc(p.banner.source)}" target="_blank" rel="noopener noreferrer">Profile banner · ${esc(p.banner.capturedAt)} capture ↗</a>` : ""}${artistLinks(p)}</div></section><div class="section-head"><h2>${id === "pete-rango" ? "On the credits" : "In the archive"}</h2><span class="tag">${list.length} recordings</span></div><div class="cards library-grid">${list.map(card).join("")}</div>${artistComments(list)}${id === "pete-rango" ? '<div class="notice"><b>Still tracing:</b> Yell & Scream — CAMPFIRE’s original announcement credits Pete as co-producer. Its token and audio are not yet resolved here. <a class="error-link" href="https://x.com/Campfire_xyz/status/1678835225378553856" target="_blank" rel="noopener noreferrer">Read the original announcement ↗</a></div>' : ""}`;
}
function proof(r) {
  const v = r.recovery;
  const explorer = explorers[r.chainId];
  return `<div class="reading"><h2>Follow the surviving record</h2>${v?.status === "indexed" ? `<p class="notice">Metadata and media references come from Catalog’s official March 9, 2026 index export. A current contract read has not succeeded yet. <a href="https://github.com/catalogworks/catalog-squidward-data" target="_blank" rel="noopener noreferrer">Published source ↗</a></p>` : ""}<p>The blockchain stores the token and its metadata reference. The recording is retrieved from the storage that reference identifies. This path does not depend on Sound’s API.</p></div><div class="provenance"><div class="proof-step"><span class="step-num">1</span><div><h3>${chainNames[r.chainId]} · Original contract</h3><code>${esc(r.contract)}</code><p>Token ID ${esc(r.tokenId)}${v?.blockNumber ? ` · Read at block ${v.blockNumber.toLocaleString()}` : ""}</p></div><a href="${explorer}/token/${r.contract}?a=${r.tokenId}" target="_blank" rel="noopener noreferrer">Inspect token ↗</a></div><div class="proof-step"><span class="step-num">2</span><div><h3>${["live", "indexed"].includes(v?.status) ? sourceKind(v.metadataURI || v.metadataURL) + " · Metadata" : "Metadata reference"}</h3><code>${esc(["live", "indexed"].includes(v?.status) ? (v.metadataURI?.startsWith("data:") ? "JSON returned directly by the contract" : v.metadataURI || v.metadataURL) : "Read the contract to resolve its metadata.")}</code><p>${v?.status === "live" ? "The token’s metadata links to the original media." : v?.status === "indexed" ? "The published index preserves this metadata reference." : "No successful current recovery is recorded yet."}</p></div>${v?.metadataURL ? `<a href="${esc(v.metadataURL)}" target="_blank" rel="noopener noreferrer">Open metadata ↗</a>` : ""}</div><div class="proof-step"><span class="step-num">3</span><div><h3>${v?.mediaURI ? sourceKind(v.mediaURI) + " · Original media" : "Original media"}</h3><code>${esc(v?.mediaURI || "Unresolved")}</code><p>Audio is stored separately from token ownership. Availability depends on the storage network.</p></div>${v?.mediaURL ? `<a href="${esc(v.mediaURL)}" target="_blank" rel="noopener noreferrer">Open original ↗</a>` : ""}</div></div><button class="outline-button" data-recover="${r.id}">↻ Read the contract again</button><div class="notice" id="verify-status">${v?.status === "live" ? `Last successful metadata recovery: ${esc(v.checkedAt)}. Playback is verified separately when you listen.` : v?.status === "indexed" ? "Recovered from Catalog’s official index; current contract verification remains pending. Playback is checked separately." : "This record has a known token reference. Its metadata has not been successfully recovered in this pass."}</div>`;
}
function matchedComments(r) {
  const matches = (archive?.comments || []).filter(
    (c) =>
      slug(c.release) === slug(cleanTitle(r.title)) &&
      slug(c.artist) === slug(r.artist),
  );
  return new Set(matches.map((c) => c.releaseId)).size === 1 ? matches : [];
}
function matchedOnchainComments(r) {
  return (archive?.onchainComments || []).filter(
    (c) =>
      c.chainId === r.chainId &&
      c.contract.toLowerCase() === r.contract.toLowerCase() &&
      c.tokenId === String(r.tokenId),
  );
}
function commentIdentity(address, name, profile) {
  return `<a class="comment-identity" href="#collector/${esc(address)}"><span class="collector-avatar" aria-hidden="true"><span>${esc((name || address?.slice(2, 4) || "?").slice(0, 2).toUpperCase())}</span>${profile?.avatar ? `<img src="${esc(profile.avatar)}" alt="" loading="lazy" onerror="this.remove()">` : ""}</span>${esc(name || profile?.name || short(address))}</a>`;
}
function artistComments(records) {
  const seen = new Set();
  const releases = records
    .map((r) => ({
      r,
      historical: matchedComments(r),
      onchain: matchedOnchainComments(r),
    }))
    .filter(({ r, historical, onchain }) => {
      const key = onchain.length
        ? `${r.chainId}:${r.contract}:${r.tokenId}`
        : historical[0]?.releaseId;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  if (!releases.length) return "";
  return `<section class="section"><div class="section-head"><div><h2>From the original releases</h2><p>Messages preserved with the recordings.</p></div></div><div class="comments">${releases
    .slice(0, 3)
    .map(({ r, historical, onchain }) => {
      const c = onchain[0] || historical[0],
        message = c.message || c.comment.message;
      return `<article class="comment"><h3><a href="${recordLink(r)}?tab=comments">${esc(cleanTitle(r.title))} ↗</a></h3><p>${esc(message.slice(0, 200))}${message.length > 200 ? "…" : ""}</p><small>${onchain.length ? "Onchain mint comments" : "Archived Sound comments"} · <a href="${recordLink(r)}?tab=comments">${onchain.length + historical.length} messages ↗</a></small></article>`;
    })
    .join("")}</div></section>`;
}
function songComments(r) {
  if (!archive)
    return '<p class="notice" role="status">Loading recovered comments…</p>';
  const matches = matchedComments(r),
    onchain = matchedOnchainComments(r);
  if (!matches.length && !onchain.length)
    return '<p class="notice">No recovered comments have been matched to this recording yet. Coverage is still partial.</p>';
  const chainSection = onchain.length
    ? `<section class="section"><div class="section-head"><div><h2>Onchain mint comments</h2><p>${onchain.length} messages · ${chainNames[r.chainId]}</p></div><span class="tag">Blockchain evidence</span></div><p class="notice">These messages accompany verified token mints. The wallet shown received the NFT; it is not necessarily the message’s author or the current holder.${onchain.some((c) => c.profile) ? " Profile names and images come from separately attributed Sound captures." : ""}</p><div class="comments">${onchain.map((c) => `<article class="comment" data-onchain-comment="${esc(c.id)}"><div class="comment-top">${commentIdentity(c.recipient, null, c.profile)}<span>Mint recipient</span></div><p>${esc(c.message)}</p><small>${date(new Date(Number(BigInt(c.timestamp)) * 1000).toISOString())} · ${esc(c.quantity)} minted · <a href="${esc(c.source)}" target="_blank" rel="noopener noreferrer">Mint transaction ↗</a>${c.profile ? ` · <a href="${esc(c.profile.source)}" target="_blank" rel="noopener noreferrer">Profile capture ↗</a>` : ""}</small></article>`).join("")}</div><details class="artist-sources"><summary>How these comments were recovered</summary><p>Matched by network, contract and token ID; decoded from the official Zora fixed-price minter and checked against the mint transfer in the same successful transaction. This covers one comment mechanism, not every kind of Zora comment. <a href="${esc(archive.onchainCommentRecovery.deploymentSource)}" target="_blank" rel="noopener noreferrer">Official deployment source ↗</a></p></details></section>`
    : "";
  const historicalSection = matches.length
    ? `<section class="section"><div class="section-head"><h2>From Sound’s archive</h2><span class="tag">Web archive</span></div><p class="notice">${matches.length} historical comments matched by release title and artist. Wallet names and edition numbers reflect the captured Sound page, not current ownership.</p><div class="comments">${matches.map((c) => `<article class="comment"><div class="comment-top">${commentIdentity(c.ownerAddressAtCapture, c.ownerUsernameAtCapture, c.profile)}<span>Slot ${esc(c.songSlot)}</span></div><p>${esc(c.comment.message)}</p><small>Edition #${esc(c.serialNumber)} · <a href="${esc(c.source)}" target="_blank" rel="noopener noreferrer">Archived source ↗</a></small></article>`).join("")}</div></section>`
    : "";
  return chainSection + historicalSection;
}
function musicFactBadges(r) {
  const facts = musicFacts(r);
  if (!facts.bpm && !facts.key) return "";
  return `<div class="music-facts" aria-label="Recovered music details">${facts.bpm ? `<span class="tag">${facts.source.startsWith("BPM estimated") ? "~" : ""}${facts.bpm} BPM</span>` : ""}${facts.key ? `<span class="tag">${esc(facts.key)}</span>` : ""}<small class="link-note">${esc(facts.source)}</small></div>`;
}
function metadataCredits(r) {
  const data = r.musicMetadata;
  if (!data) return "";
  const details = Object.entries(data.details || {}).filter(
    ([key]) => !["Description", "Lyrics"].includes(key),
  );
  const lyrics = data.hasLyrics && data.metadataURL;
  const description =
    data.details?.Description?.filter((text) => text !== r.note) || [];
  return `${description.length ? `<details class="artist-sources"><summary>Original release notes</summary>${description.map((text) => `<p>${esc(text)}</p>`).join("")}</details>` : ""}${data.collaborators.length || data.credits.length ? `<h2>Original credits</h2>${data.collaborators.length ? `<p>${esc(data.collaborators.join(" · "))}</p>` : ""}${data.credits.map((credit) => `<p>${esc(credit)}</p>`).join("")}` : ""}${details.length ? `<details class="artist-sources"><summary>More about this recording</summary><dl>${details.map(([label, values]) => `<dt>${esc(label)}</dt><dd>${esc(values.join(" · "))}${label === "Duration" ? " seconds" : ""}</dd>`).join("")}</dl></details>` : ""}${lyrics ? `<p><a class="link-note" href="${esc(data.metadataURL)}" target="_blank" rel="noopener noreferrer">Lyrics in the original metadata ↗</a></p>` : ""}${data.metadataURL ? `<a class="link-note" href="${esc(data.metadataURL)}" target="_blank" rel="noopener noreferrer">${data.snapshotDate ? "Metadata saved by Catalog" : "Original token metadata"} ↗</a>` : ""}`;
}
function songRevenue(r) {
  const revenue = r.revenue;
  if (!revenue) return "";
  return `<section class="song-revenue"><h2>Support for this release</h2><p><strong>${esc(revenue.artistPaid)} USDC</strong> in verified artist payouts</p><p>${esc(revenue.gross)} USDC in recorded purchases · ${revenue.purchaseCount} purchase${revenue.purchaseCount === 1 ? "" : "s"}</p><details class="artist-sources"><summary>Payments and sources</summary><p>Catalog’s March 9, 2026 export, checked against USDC transfers on Base. Partial recovery: includes only Base token purchases whose receipts and artist transfers were verified; album purchases, resales, and later activity are not included. Artist payouts can go to a collaborator split contract. This is not lifetime income or the artist’s personal take-home pay.</p><p>Platform: ${esc(revenue.platformPaid)} USDC · Referrals: ${esc(revenue.referralsPaid)} USDC</p>${revenue.events.map((event) => `<p><a href="https://basescan.org/tx/${esc(event.transaction)}" target="_blank" rel="noopener noreferrer">${esc(event.date.slice(0, 10))} · ${esc(event.gross)} USDC purchase ↗</a></p>`).join("")}<a href="https://github.com/catalogworks/catalog-squidward-data" target="_blank" rel="noopener noreferrer">Catalog’s original export ↗</a></details></section>`;
}

function recordPage(id) {
  const r = catalog.find((x) => x.id === id);
  if (!r)
    return '<div class="empty">Recording not found. <a href="#explore">Browse the archive.</a></div>';
  return `<a class="back" href="#explore">← Explore the archive</a><section class="record-head"><div class="cover">${img(r)}</div><div><span class="eyebrow">${esc(platform(r))} · ${chainNames[r.chainId]} · ${r.kind === "artwork" ? "ARTWORK COLLECTIBLE" : r.kind === "video" ? "VIDEO" : "RECORDING"}</span><h1>${esc(cleanTitle(r.title))}</h1><p><a href="#artist/${artistId(r)}">${esc(r.artist)}</a></p><div class="actions">${r.kind === "artwork" ? `<p class="notice">This token points to artwork. No separate audio was identified in its metadata.</p>` : `<button class="primary" data-play="${r.id}">▶ &nbsp; Listen now</button><button class="outline-button" data-queue="${r.id}">＋ Add to queue</button><button class="outline-button" data-add-playlist="${r.id}">＋ Add to playlist</button>`}<button class="icon heart ${likes.has(r.id) ? "active" : ""}" data-like="${r.id}" aria-label="Like recording">${likes.has(r.id) ? "♥" : "♡"}</button></div></div></section><div class="tabs" role="tablist" aria-label="Recording details">${[
    ["about", "Details"],
    ["collectors", "Collectors"],
    ["proof", "Provenance"],
    ["comments", "Comments"],
  ]
    .map(
      ([key, name]) =>
        `<button role="tab" aria-selected="${tab === key}" class="${tab === key ? "active" : ""}" data-tab="${key}">${name}</button>`,
    )
    .join(
      "",
    )}</div><div role="tabpanel">${tab === "comments" ? songComments(r) : tab === "proof" ? proof(r) : tab === "collectors" ? `${collectors.panel(r, true)}<details class="ownership-tools"><summary>Additional ownership tools</summary><div class="reading"><h2>Who holds this edition?</h2><p>Read the owner of token ${r.tokenId} directly from ${chainNames[r.chainId]}. This is the current holder of one edition, not a complete collector list or proof of who originally minted it.</p></div><div id="owner-result"><button class="outline-button" data-owner="${r.id}">Read owner from the blockchain ↗</button></div><div class="reading"><h2>Contract holders</h2><p>Current balances reported by the chain indexer. A contract may contain multiple songs; these holders are not automatically collectors of this particular track. ENS labels are current indexer data.</p></div><button class="outline-button" data-holders="${r.id}">Load indexed holders</button><div id="holders-result"></div><div class="notice">Full mint-history reconstruction is still in progress. Today’s owner is not necessarily the original supporter.</div></details>` : `<div class="reading"><h2>Behind the music</h2>${musicFactBadges(r)}<p>${esc(r.note || "Recovered from an original music NFT. Follow the provenance tab to inspect its source.")}</p>${r.credits?.length ? `<h2>Credits</h2>${r.credits.map((c) => `<p><a href="#artist/${c.personId}">${esc(person(c.personId).name)}</a> — ${esc(c.role)}</p>`).join("")}` : ""}${metadataCredits(r)}${songRevenue(r)}<h2>Preservation notes</h2><p>This archive holds a selected token reference for this work. A single recording can have many editions, and a contract can hold multiple works. The catalog is a starting point for recovery, not a claim of completeness.</p>${r.originalRelease ? `<p><a class="error-link" href="https://web.archive.org/web/*/${esc(r.originalRelease)}" target="_blank" rel="noopener noreferrer">Find the original release in the Internet Archive ↗</a></p>` : ""}<p><a class="error-link" href="${recordLink(r)}?tab=proof">Inspect the contract and original storage addresses ↗</a></p></div>${collectors.panel(r, true)}`}</div>`;
}
function catalogCoverageView() {
  const c = coverage?.catalogWorks;
  if (!c) return "";
  return `<section class="coverage-block"><div class="section-head"><div><h2>Catalog Works recovery</h2><p>Official March 9, 2026 index snapshot, with current contract reads tracked separately.</p></div></div><div class="stats-grid"><div class="stat"><strong>${c.ethereum}</strong><span>Ethereum token entries</span></div><div class="stat"><strong>${c.base}</strong><span>Base token entries</span></div><div class="stat"><strong>${c.indexedMedia}</strong><span>Archived metadata with media references</span></div><div class="stat"><strong>${c.currentMetadata}</strong><span>Metadata verified through current contract reads</span></div></div><p class="link-note">Token entries can share a recording or represent an unminted edition. These counts do not establish unique song totals, complete current platform coverage, or successful playback of every file. <a href="https://github.com/catalogworks/catalog-squidward-data" target="_blank" rel="noopener noreferrer">Official source ↗</a></p></section>`;
}
function coverageView() {
  if (!coverage) return "";
  const m = coverage.manifest,
    p = coverage.playback;
  return `<section class="coverage-block"><div class="section-head"><div><h2>Sound contract census</h2><p>Factory creation events, scanned through recorded chain blocks.</p></div></div><div class="table-wrap"><table class="ledger"><thead><tr><th>Network</th><th>Contract generation</th><th>Discovered</th><th>Scan coverage</th><th>Through block</th></tr></thead><tbody>${(m.factories || []).map((f) => `<tr><td>${chainNames[f.chainId] || f.chainId}</td><td>${f.version === 0 ? "Legacy artist contracts" : "Release factory V" + f.version}</td><td>${f.contracts.toLocaleString()}</td><td>${f.complete ? "All index pages read" : "Partial · retryable"}</td><td>${f.toBlock?.toLocaleString() || "—"}</td></tr>`).join("")}${(coverage.additionalChains || []).map((f) => `<tr><td>${{ 8453: "Base", 137: "Polygon" }[f.chainId]}</td><td>V2 factory code verified</td><td>Not established</td><td>Historical RPC access limited</td><td>—</td></tr>`).join("")}</tbody></table></div><p class="link-note">Scope: known factory deployments. Pagination completeness is specific to the public index and recorded block; it is not proof that every possible Sound-related contract has been found. Canonical addresses on other chains are separately probed and verified.</p><div class="stats-grid"><div class="stat"><strong>${coverage.expansion?.recovered || 0}</strong><span>Modern releases with recovered metadata</span></div><div class="stat"><strong>${coverage.legacy?.records || 0}</strong><span>Legacy artist editions recovered</span></div><div class="stat"><strong>${p?.played || 0} / ${p?.checked || 0}</strong><span>Starting-catalog playback checks passed</span></div><div class="stat"><strong>${p?.unavailable || 0}</strong><span>Playback checks need retry or media classification</span></div><div class="stat"><strong>${coverage.expansion?.unminted || 0}</strong><span>Contracts with zero minted tokens at the checked block</span></div><div class="stat"><strong>${coverage.expansion?.unresolved || 0}</strong><span>Attempted contracts still unresolved</span></div></div><p class="link-note">Representative-token diagnosis: ${coverage.soundMetadataGaps?.["metadata-without-audio"] || 0} readable metadata documents have empty audio fields; ${coverage.soundMetadataGaps?.unavailable || 0} reads remain unavailable. Other token tiers may still contain audio.</p><p class="link-note">Playback checks start the actual original media in Chromium; they are not full-track auditions. New discoveries are playable on demand but are not counted as playback-tested until checked separately.</p></section>`;
}
function recovery() {
  const live = catalog.filter((r) => r.recovery?.status === "live");
  return `<div class="intro"><div><h1>The recovery ledger</h1><p>Evidence you can follow. Gaps you can see. Nothing silently filled in.</p></div><a class="outline-button" href="/api/manifest" download>↓ Export evidence</a></div><div class="stats-grid"><div class="stat"><strong>${summary.catalogued}</strong><span>Catalogued records</span></div><div class="stat"><strong>${summary.readable}</strong><span>Metadata recovered through contracts</span></div><div class="stat"><strong>${summary.unavailable}</strong><span>Reads unavailable · retryable</span></div><div class="stat"><strong>${summary.notAttempted}</strong><span>Awaiting this recovery pass</span></div><div class="stat"><strong>${summary.indexed || 0}</strong><span>Official Catalog index metadata · current read pending</span></div></div><div class="reading"><p><a class="error-link" href="#community">Browse the complete archived comment evidence ↗</a></p><h2>What this proves</h2><p>A token can outlive the interface that sold it. We query its original contract, recover its metadata, and resolve the media it points to. Ownership lives onchain; audio usually lives on Arweave or IPFS. Neither a working metadata link nor an old capture guarantees every file remains playable.</p><h2>What this doesn’t claim</h2><p>The NFT Era catalog is now expanded with releases recovered from Sound factory events and legacy edition registries. The census below states the scanned scope; it does not imply that every recording, historical collector, profile, or comment has been recovered. Sound deployment discovery includes Ethereum and Optimism; Base and Zora are also supported for the broader music NFT catalog. Each token is identified by chain, contract, and token ID.</p></div>${catalogCoverageView()}${coverageView()}<div class="source-legend"><span><b>◈ Blockchain</b> · token, owner, metadata reference</span><span><b>↗ Storage</b> · audio, artwork, metadata</span><span><b>◌ Web archive</b> · captured social context</span></div><div class="section-head"><h2>Recording-level evidence</h2><button class="text-button" data-refresh>↻ Refresh recovery status</button></div><div class="table-wrap"><table class="ledger"><thead><tr><th>Recording</th><th>Network</th><th>Media storage</th><th>Metadata read</th><th>Evidence</th></tr></thead><tbody>${catalog
    .slice(0, ledgerLimit)
    .map(
      (r) =>
        `<tr><td><a href="${recordLink(r)}">${esc(cleanTitle(r.title))}</a><small>${esc(r.artist)}</small></td><td>${chainNames[r.chainId]}</td><td>${r.recovery?.mediaURI ? sourceKind(r.recovery.mediaURI) : "Unresolved"}</td><td class="${r.recovery?.status === "live" ? "resolved" : ""}">${r.recovery?.status === "live" ? "✓ Recovered" : r.recovery?.status === "indexed" ? "Official index snapshot" : r.recovery ? "Retry needed" : "Not attempted"}<small>${r.recovery?.blockNumber ? "Block " + r.recovery.blockNumber.toLocaleString() : ""}</small></td><td><a class="error-link" href="${recordLink(r)}?tab=proof">Trace ↗</a></td></tr>`,
    )
    .join(
      "",
    )}</tbody></table></div>${catalog.length > ledgerLimit ? '<button class="outline-button more" data-more-ledger>Load more evidence</button>' : ""}`;
}
function matchTrack(t) {
  const exact = catalog.filter(
    (r) =>
      r.originalRelease?.replace(/\/$/, "") ===
      `https://www.sound.xyz/${t.artistHandle}/${t.titleSlug}`,
  );
  if (exact.length) return exact.find((r) => r.kind !== "artwork");
  const candidates = catalog.filter(
    (r) =>
      slug(cleanTitle(r.title)) === slug(t.title) &&
      slug(r.artist) === slug(t.artist) &&
      r.kind !== "artwork",
  );
  return candidates.length === 1 ? candidates[0] : undefined;
}
function playlists() {
  if (!archive) return '<div class="loading">Loading the archive…</div>';
  const p = archive.playlist,
    known = p.tracks.filter((t) => !t.missing);
  return `<div class="intro"><div><h1>Playlists from the era</h1><p>Preserving the selections people made, with their original attribution.</p></div></div><section class="playlist-feature"><div class="collage">${known
    .slice(0, 4)
    .map((t) => `<img src="${esc(t.coverURL)}" alt="${esc(t.title)} artwork">`)
    .join(
      "",
    )}</div><div><span class="eyebrow">WEB ARCHIVE · JANUARY 20, 2023</span><h2>${esc(p.name)}</h2><p>By ${esc(p.curator)} · ${p.declaredCount} original tracks<br>${esc(p.description)}</p><p>${known.length} track details recovered · ${p.tracks.length - known.length} track IDs still unresolved</p><a class="text-button error-link" href="${p.source}" target="_blank" rel="noopener noreferrer">Open the original capture ↗</a></div></section><div class="notice">This playlist comes from archived Sound page data, not the blockchain. Its track-ID sequence survives. The page embedded only the first 15 track details and indicated more API pages. One additional entry was recovered by its exact track ID from a separate July 2022 capture. The remaining seven IDs are gaps in the captures, not evidence that their NFTs or music are missing from the blockchain. Playback is offered only where a track matches our blockchain catalog.</div>${p.tracks
    .map((t) => {
      const r = !t.missing && matchTrack(t);
      return `<div class="track-row"><span class="index">${t.index + 1}</span>${!t.missing ? `<img src="${esc(t.coverURL)}" alt=""><div><strong>${esc(t.title)}</strong><small>${esc(t.artist)}${t.source ? ` · <a href="${esc(t.source)}" target="_blank" rel="noopener noreferrer">Recovered detail source ↗</a>` : ""}</small></div>` : `<div><strong>Track details not yet recovered</strong><small>Preserved track ID: ${esc(t.id)}</small></div>`}<div class="track-action">${r ? `<button class="outline-button" data-play="${r.id}">▶ Play recovered token</button>` : "<span>Awaiting token match</span>"}</div></div>`;
    })
    .join("")}`;
}
let communityRelease = "";
function community() {
  if (!archive) return '<div class="loading">Loading captured memories…</div>';
  const names = [...new Set(archive.comments.map((c) => c.release))];
  if (!communityRelease) communityRelease = names[0];
  const comments = archive.comments.filter(
    (c) => c.release === communityRelease,
  );
  return `<div class="intro"><div><h1>Archived comment evidence</h1><p>Actual words left on Sound. Recovered from historical Sound web captures.</p></div></div><div class="notice"><b>Web-archived context.</b> These ${archive.comments.length} comments were embedded in archived Sound homepage data. They were not recovered from the blockchain. Names and owners reflect that captured page; song slots are preserved as recorded, not converted into unverified timestamps.</div><div class="community-picker">${names.map((n) => `<button class="chip ${communityRelease === n ? "active" : ""}" data-community="${esc(n)}">${esc(n)}</button>`).join("")}</div><div class="section-head"><div><h2>${esc(communityRelease)}</h2><p>${comments.length} captured comments · a partial snapshot</p></div><a class="text-button" href="https://web.archive.org/web/20230501061119/https://www.sound.xyz/" target="_blank" rel="noopener noreferrer">View source ↗</a></div><div class="comments">${comments.map((c) => `<article class="comment"><div class="comment-top"><span><a href="#collector/${esc(c.ownerAddressAtCapture)}">${esc(c.ownerUsernameAtCapture || short(c.ownerAddressAtCapture))}</a></span><span>Slot ${c.songSlot}</span></div><p>${esc(c.comment.message)}</p><small>Edition #${c.serialNumber} · ${date(c.comment.updatedAt)} · <a href="${esc(c.source)}" target="_blank" rel="noopener noreferrer">Capture source ↗</a></small></article>`).join("")}</div>`;
}
const walletLibrary = mountWalletLibrary({
  esc,
  catalog: () => catalog,
  card,
  rerender: () => route(),
});
function profilePage() {
  const args = new URLSearchParams(location.hash.split("?")[1]);
  const selected = args.get("tab") === "playlists" ? "playlists" : "collection";
  return `<div class="intro"><div><h1>My profile</h1><p>Your wallets, collected music and playlists, together.</p></div></div><div id="profile-account"><p class="notice">Account connection is loading. You can browse a public wallet and create playlists below without signing in.</p></div><div class="tabs" role="tablist" aria-label="Your library">${[
    ["collection", "My collection"],
    ["playlists", "My playlists"],
  ]
    .map(
      ([key, label]) =>
        `<button id="profile-tab-${key}" role="tab" aria-selected="${selected === key}" aria-controls="profile-panel-${key}" class="${selected === key ? "active" : ""}" data-profile-tab="${key}">${label}</button>`,
    )
    .join(
      "",
    )}</div><section id="profile-panel-collection" role="tabpanel" aria-labelledby="profile-tab-collection" ${selected !== "collection" ? "hidden" : ""}>${walletLibrary.view(args.get("wallet") || "", true)}</section><section id="profile-panel-playlists" role="tabpanel" aria-labelledby="profile-tab-playlists" ${selected !== "playlists" ? "hidden" : ""}>${personalPlaylists.view(null, true)}</section>`;
}
document.addEventListener("click", (e) => {
  const button = e.target.closest("[data-profile-tab]");
  if (!button) return;
  const args = new URLSearchParams(location.hash.split("?")[1]);
  args.set("tab", button.dataset.profileTab);
  location.hash = "me?" + args;
});
function route() {
  renderVersion++;
  const [base, args] = location.hash.slice(1).split("?");
  const [view = "home", id] = base.split("/");
  tab = new URLSearchParams(args).get("tab") || "about";
  document
    .querySelectorAll("[data-nav]")
    .forEach((a) =>
      a.classList.toggle("active", a.dataset.nav === (view || "home")),
    );
  main.innerHTML =
    view === "me"
      ? profilePage()
      : view === "wallet"
        ? walletLibrary.view(id || "")
        : view === "collector"
          ? collectors.profilePage(id || "")
          : view === "explore"
            ? explore()
            : view === "liked"
              ? explore(true)
              : view === "artists"
                ? artists()
                : view === "artist"
                  ? artistPage(decodeURIComponent(id || ""))
                  : view === "record"
                    ? recordPage(decodeURIComponent(id || ""))
                    : view === "recovery"
                      ? recovery()
                      : view === "playlists"
                        ? personalPlaylists.view()
                        : view === "playlist"
                          ? personalPlaylists.view(id)
                          : view === "historic-playlists"
                            ? playlists()
                            : view === "community"
                              ? community()
                              : home();
  document.dispatchEvent(new Event("mn:route"));
  if (view === "record") queueMicrotask(() => collectors.load(id));
  if (view === "collector" && !collectors.hasProfile(id))
    queueMicrotask(() => collectors.loadProfile(id));
  $("#liked-count").textContent = likes.size;
  document.title =
    (view === "record"
      ? cleanTitle(catalog.find((r) => r.id === id)?.title || "Recording")
      : "The music remains.") + " — Music Nerd";
}
async function loadCatalog() {
  const res = await fetch("/api/catalog");
  if (!res.ok) throw Error("Catalog unavailable");
  const d = await res.json();
  try {
    coverage = await (await fetch("/api/coverage")).json();
  } catch {}
  catalog = d.records;
  people = d.people;
  summary = d.summary;
}
function toggleLike(id) {
  likes.has(id) ? likes.delete(id) : likes.add(id);
  try {
    localStorage.setItem("mn-archive-likes", JSON.stringify([...likes]));
  } catch {}
  route();
  if (current)
    $("#player-like").textContent = likes.has(current.id) ? "♥" : "♡";
}
let mediaRecovery,
  mediaTimer,
  wantsPlayback = false;
async function play(id, list = null, index = null) {
  const r = catalog.find((r) => r.id === id);
  if (!r || r.kind === "artwork") return;
  const version = ++playVersion;
  mediaRecovery?.dispose();
  clearTimeout(mediaTimer);
  wantsPlayback = true;
  audio.pause();
  if (list) {
    queue = list;
    queueIndex = index ?? list.indexOf(id);
  } else if (queue[queueIndex] !== id) {
    queue = [id];
    queueIndex = 0;
  }
  current = r;
  document.body.classList.add("has-player");
  $("#player").hidden = false;
  $("#player-title").textContent = cleanTitle(r.title);
  $("#player-artist").textContent = r.artist;
  $("#player-art").src = image(r);
  $("#player-source").textContent = "Resolving original media…";
  $("#toggle").textContent = "…";
  audio.classList.toggle("video-visible", r.kind === "video");
  let v = r.recovery;
  if (!["live", "indexed"].includes(v?.status)) {
    try {
      const res = await fetch("/api/recover/" + encodeURIComponent(id));
      v = await res.json();
      if (v.status !== "live") throw Error();
      r.recovery = v;
    } catch {
      if (version === playVersion) {
        $("#player-source").textContent =
          "Recovery unavailable — retry from Provenance";
        $("#toggle").textContent = "▶";
        notify(
          "The original metadata could not be reached. You can retry from Provenance.",
        );
      }
      return;
    }
  }
  if (version !== playVersion) return;
  audio.src = r.playback?.workingURL || v.mediaURL;
  const exhausted = () => {
    if (version !== playVersion) return;
    clearTimeout(mediaTimer);
    audio.pause();
    $("#player-source").textContent =
      "Original media unavailable — press play to retry";
    notify(
      "Metadata survived, but the original media could not be played. You can retry.",
    );
  };
  mediaRecovery = createMediaRecovery(audio, {
    originalURL: r.playback?.workingURL || v.mediaURL,
    shouldPlay: () => wantsPlayback && version === playVersion,
    onSwitch: () => {
      $("#player-source").textContent =
        "Retrying the same IPFS content through another gateway…";
      clearTimeout(mediaTimer);
      mediaTimer = setTimeout(exhausted, 18000);
    },
    onExhausted: exhausted,
  });
  mediaTimer = setTimeout(() => {
    if (version === playVersion && audio.currentTime === 0 && wantsPlayback)
      mediaRecovery.recover();
  }, 12000);
  $("#player-source").textContent =
    `${chainNames[r.chainId]} → ${sourceKind(v.mediaURI)} · Original media`;
  $("#player-like").textContent = likes.has(id) ? "♥" : "♡";
  try {
    await audio.play();
  } catch {
    if (version === playVersion && !audio.error) {
      $("#toggle").textContent = "▶";
      notify(
        "Playback could not start. Press play to retry; the original media may be unavailable.",
      );
    }
  }
}
function showQueue() {
  const list = $("#queue-list");
  list.innerHTML = queue.length
    ? queue
        .map((id, i) => {
          const r = catalog.find((x) => x.id === id);
          return `<div class="queue-item ${i === queueIndex ? "current" : ""}"><span>${i + 1}</span><img src="${esc(image(r))}" alt=""><div>${esc(cleanTitle(r.title))}<small>${esc(r.artist)}</small></div><button class="icon" data-queue-play="${i}" aria-label="Play ${esc(r.title)}">▶</button></div>`;
        })
        .join("")
    : '<div class="empty">Add recordings to your queue from any release page.</div>';
  $("#queue-dialog").showModal();
}
document.addEventListener("click", async (e) => {
  const el = e.target.closest("button,a");
  if (!el) return;
  if (el.dataset.play) {
    play(el.dataset.play);
    return;
  }
  if (el.dataset.like) {
    toggleLike(el.dataset.like);
    return;
  }
  if (el.dataset.queue) {
    queue.push(el.dataset.queue);
    notify("Added to your listening queue");
    return;
  }
  if (el.dataset.queuePlay !== undefined) {
    const i = Number(el.dataset.queuePlay);
    play(queue[i], queue, i);
    $("#queue-dialog").close();
    return;
  }
  if (el.hasAttribute("data-close")) $("#queue-dialog").close();
  if (el.hasAttribute("data-clear-filters")) {
    filter = "All";
    facets = { network: "", media: "", sort: "archive", collection: "" };
    query = "";
    $("#search").value = "";
    limit = 40;
    moreFilters = false;
    route();
  }
  if (el.dataset.filter) {
    filter = el.dataset.filter;
    limit = 40;
    route();
  }
  if (el.hasAttribute("data-more-artists")) {
    artistLimit += 48;
    route();
  }
  if (el.hasAttribute("data-more-ledger")) {
    ledgerLimit += 100;
    route();
  }
  if (el.hasAttribute("data-more")) {
    limit += 40;
    route();
  }
  if (el.dataset.community) {
    communityRelease = el.dataset.community;
    route();
  }
  if (el.dataset.tab) {
    location.hash = location.hash.split("?")[0] + "?tab=" + el.dataset.tab;
  }
  if (el.hasAttribute("data-refresh")) {
    el.disabled = true;
    await loadCatalog();
    route();
  }
  if (el.dataset.recover) {
    const r = catalog.find((x) => x.id === el.dataset.recover);
    const render = renderVersion;
    el.disabled = true;
    $("#verify-status").textContent =
      "Reading the contract, then resolving original metadata…";
    try {
      const res = await fetch("/api/recover/" + encodeURIComponent(r.id));
      const v = await res.json();
      if (v.status !== "live") throw Error();
      r.recovery = { ...v, localImage: r.recovery?.localImage };
      if (render === renderVersion) {
        route();
        notify(
          "Contract and metadata recovered at block " +
            v.blockNumber.toLocaleString(),
        );
      }
    } catch {
      if (render === renderVersion) {
        el.disabled = false;
        $("#verify-status").textContent =
          "The read could not complete. Any prior successful evidence remains visible. Please retry.";
      }
    }
  }
  if (el.dataset.holders) {
    const r = catalog.find((x) => x.id === el.dataset.holders),
      render = renderVersion;
    el.disabled = true;
    el.textContent = "Reading holder index…";
    try {
      const cursor = el.dataset.cursor;
      const res = await fetch(
        "/api/holders/" +
          encodeURIComponent(r.id) +
          (cursor ? "?cursor=" + encodeURIComponent(cursor) : ""),
      );
      const v = await res.json();
      if (render !== renderVersion) return;
      if (v.status !== "indexed") throw Error();
      const rows = v.items
        .map(
          (h) =>
            `<div class="owner-row holder"><span class="wallet-icon">◈</span><div><p>${esc(h.ens || short(h.address))}</p><small>${esc(h.address)}</small></div><span class="tag">${esc(h.balance)} held</span><a href="${explorers[r.chainId]}/address/${h.address}" target="_blank" rel="noopener noreferrer">↗</a></div>`,
        )
        .join("");
      $("#holders-result").insertAdjacentHTML(
        "beforeend",
        `<p class="holder-source"><a href="${esc(v.source)}" target="_blank" rel="noopener noreferrer">Blockscout source ↗</a> · checked ${esc(v.checkedAt)}</p>` +
          rows,
      );
      el.disabled = false;
      el.textContent = v.nextCursor
        ? "Load more holders"
        : "All indexed holders loaded";
      el.dataset.cursor = v.nextCursor || "";
      if (!v.nextCursor) el.disabled = true;
      notify("Holder balances from Blockscout · " + date(v.checkedAt));
    } catch {
      el.disabled = false;
      el.textContent = "Retry holder index";
      notify(
        "Holder index unavailable. Retry or use the direct token-owner lookup.",
      );
    }
  }
  if (el.dataset.owner) {
    const r = catalog.find((x) => x.id === el.dataset.owner),
      render = renderVersion;
    el.disabled = true;
    el.textContent = "Reading ownerOf…";
    try {
      const res = await fetch("/api/owner/" + encodeURIComponent(r.id));
      const v = await res.json();
      if (render !== renderVersion) return;
      if (v.status === "verified") {
        $("#owner-result").innerHTML =
          `<div class="owner-row"><span class="wallet-icon">◈</span><div><p>${esc(v.address)}</p><small>Token ${r.tokenId} · verified at block ${v.blockNumber.toLocaleString()} · ${date(v.checkedAt)}</small></div><a href="${explorers[r.chainId]}/address/${v.address}" target="_blank" rel="noopener noreferrer">Explorer ↗</a></div>`;
      } else {
        el.disabled = false;
        el.textContent = "Retry owner lookup";
        notify(v.message);
      }
    } catch {
      el.disabled = false;
      el.textContent = "Retry owner lookup";
      notify("Owner lookup unavailable. Try again.");
    }
  }
});
document.addEventListener(
  "error",
  (e) => {
    if (e.target.tagName === "IMG") {
      const img = e.target;
      img.style.display = "none";
      const holder = img.closest(".cover") || img.parentElement;
      if (
        holder.classList.contains("artist-card") ||
        holder.classList.contains("cover") ||
        holder.classList.contains("profile-head")
      ) {
        const fallback = document.createElement("span");
        fallback.className = !holder.classList.contains("cover")
          ? "artist-placeholder"
          : "cover-fallback";
        fallback.textContent = !holder.classList.contains("cover")
          ? (img.alt || "?").slice(0, 2).toUpperCase()
          : "♫";
        holder.prepend(fallback);
      }
    }
  },
  true,
);
document.addEventListener("change", (e) => {
  const name = e.target.dataset.facet;
  if (!Object.hasOwn(facets, name)) return;
  moreFilters = !!document.querySelector(".more-filters")?.open;
  facets[name] = e.target.value;
  limit = 40;
  route();
  document.querySelector(`[data-facet="${name}"]`)?.focus();
});
$("#search").addEventListener("input", (e) => {
  query = e.target.value;
  limit = 40;
  if (location.hash !== "#explore") location.hash = "explore";
  else route();
});
document.addEventListener("input", (e) => {
  if (e.target.id === "artist-search") {
    artistQuery = e.target.value;
    artistLimit = 48;
    const pos = e.target.selectionStart;
    route();
    const field = $("#artist-search");
    field.focus();
    try {
      field.setSelectionRange(pos, pos);
    } catch {}
  }
});
document.addEventListener("keydown", (e) => {
  if (
    e.key === "/" &&
    !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)
  ) {
    e.preventDefault();
    $("#search").focus();
  }
});
$("#theme").onclick = () => {
  const theme =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("mn-archive-theme", theme);
  } catch {}
};
$("#mobile-queue").onclick = showQueue;
$("#show-queue").onclick = showQueue;
$("#queue-now").onclick = showQueue;
$("#player-title").onclick = () => {
  if (current) location.hash = recordLink(current);
};
$("#proof-now").onclick = () => {
  if (current) location.hash = recordLink(current) + "?tab=proof";
};
$("#player-like").onclick = () => current && toggleLike(current.id);
$("#toggle").onclick = async () => {
  if (!current) return;
  if (audio.paused) {
    wantsPlayback = true;
    if (audio.error || $("#player-source").textContent.includes("unavailable"))
      return play(current.id, queue, queueIndex);
    if (!audio.getAttribute("src")) return play(current.id, queue);
    try {
      await audio.play();
    } catch {
      notify(
        "The original audio could not be played. Retry the contract read from Provenance.",
      );
    }
  } else {
    wantsPlayback = false;
    clearTimeout(mediaTimer);
    audio.pause();
  }
};
$("#next").onclick = () => {
  if (queueIndex + 1 < queue.length)
    play(queue[queueIndex + 1], queue, queueIndex + 1);
  else notify("End of queue. Add another recording to keep listening.");
};
$("#previous").onclick = () => {
  if (audio.currentTime > 3) audio.currentTime = 0;
  else if (queueIndex > 0) play(queue[queueIndex - 1], queue, queueIndex - 1);
};
$("#seek").oninput = (e) => {
  if (Number.isFinite(audio.duration))
    audio.currentTime = (Number(e.target.value) / 1000) * audio.duration;
};
$("#volume").oninput = (e) => (audio.volume = Number(e.target.value));
$("#mute").onclick = () => {
  audio.muted = !audio.muted;
  $("#mute").textContent = audio.muted ? "×))" : "◖))";
};
audio.addEventListener("timeupdate", () => {
  if (audio.currentTime > 0) clearTimeout(mediaTimer);
  $("#elapsed").textContent = time(audio.currentTime);
  $("#duration").textContent = time(audio.duration);
  $("#seek").value = Number.isFinite(audio.duration)
    ? (audio.currentTime / audio.duration) * 1000
    : 0;
});
audio.addEventListener("play", () => {
  $("#toggle").textContent = "Ⅱ";
  $("#toggle").setAttribute("aria-label", "Pause");
});
audio.addEventListener("pause", () => {
  $("#toggle").textContent = "▶";
  $("#toggle").setAttribute("aria-label", "Play");
});
audio.addEventListener("ended", () => {
  if (queueIndex + 1 < queue.length)
    play(queue[queueIndex + 1], queue, queueIndex + 1);
});
const mobile = document.createElement("div");
mobile.className = "mobile-nav";
mobile.setAttribute("aria-label", "Mobile navigation");
mobile.innerHTML = [
  ["home", "⌂", "Home"],
  ["explore", "▦", "Explore"],
  ["artists", "♧", "Artists"],
  ["playlists", "☷", "Playlists"],
  ["me", "○", "Profile"],
]
  .map(
    ([id, icon, label]) =>
      `<a href="#${id}" data-nav="${id}">${icon}<span>${label}</span></a>`,
  )
  .join("");
document.body.append(mobile);
window.addEventListener("hashchange", (event) => {
  const oldHash = new URL(event.oldURL).hash,
    nextHash = new URL(event.newURL).hash;
  const sameProfile =
    oldHash.split("?")[0] === "#me" &&
    nextHash.split("?")[0] === "#me" &&
    new URLSearchParams(oldHash.split("?")[1]).get("wallet") ===
      new URLSearchParams(nextHash.split("?")[1]).get("wallet");
  if (sameProfile && main.querySelector("[data-profile-tab]")) {
    const selected =
      new URLSearchParams(nextHash.split("?")[1]).get("tab") === "playlists"
        ? "playlists"
        : "collection";
    main.querySelectorAll("[data-profile-tab]").forEach((button) => {
      const active = button.dataset.profileTab === selected;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
      document.getElementById(button.getAttribute("aria-controls")).hidden =
        !active;
    });
    return;
  }
  const sameSong =
    oldHash.startsWith("#record/") &&
    oldHash.split("?")[0] === nextHash.split("?")[0];
  if (sameSong && main.querySelector('[role="tabpanel"]')) {
    const y = scrollY;
    tab =
      new URLSearchParams(nextHash.split("?")[1] || "").get("tab") || "about";
    const id = decodeURIComponent(nextHash.split("?")[0].slice(8));
    const template = document.createElement("template");
    template.innerHTML = recordPage(id);
    const panel = main.querySelector('[role="tabpanel"]');
    panel.replaceChildren(
      ...template.content.querySelector('[role="tabpanel"]').childNodes,
    );
    main.querySelectorAll("[data-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === tab);
      button.setAttribute("aria-selected", String(button.dataset.tab === tab));
    });
    window.scrollTo({ top: y, behavior: "instant" });
    collectors.load(id);
    return;
  }
  route();
  window.scrollTo({ top: 0, behavior: "instant" });
});
try {
  await loadCatalog();
  route();
  fetch("/api/archive")
    .then((r) => r.json())
    .then((d) => {
      archive = d;
      if (
        ["#historic-playlists", "#community"].includes(location.hash) ||
        location.hash.startsWith("#artist/") ||
        (location.hash.startsWith("#record/") &&
          location.hash.includes("tab=comments"))
      )
        route();
    })
    .catch(() =>
      notify("Archived community data could not load. Reload to retry."),
    );
} catch {
  main.innerHTML =
    '<div class="empty"><h2>The catalog could not load.</h2><p>Restart the local server and reload this page.</p></div>';
}
