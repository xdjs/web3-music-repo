import {
  recordingControlState,
  recordingControlSelector,
  syncRecordingControls,
} from "./playback-controls.mjs";
import { mountNowPlaying } from "./now-playing.mjs";
import { renderLyrics } from "./lyrics-ui.mjs";
import { mountQueueSortable } from "./queue-sortable.mjs";
import {
  createShuffleQueue,
  selectShuffledTrack,
  toggleQueueShuffle,
  appendShuffleQueue,
  removeShuffleQueue,
  clearShuffleQueue,
  moveShuffleQueue,
} from "./queue-shuffle.mjs";
import { createMediaPreloader } from "./media-preload.mjs";
import {
  createNextTrackBuffer,
  hasPlaybackHeadroom,
} from "./next-track-buffer.mjs";
import { compareReleaseDates } from "./release-date.mjs";
import { navIcon } from "./nav-icons.mjs";
import { renderRoyaltyPayments } from "./catalog-royalty-ui.mjs";
import { installImageRecovery } from "./image-recovery.mjs";
import { musicFacts } from "./music-facts.mjs";
import { mountWalletLibrary } from "./wallet-library-ui.mjs";
import { mountCollectors } from "./collectors-ui.mjs";
import { createMediaRecovery } from "./media-recovery.js";
import { mountPlaylists } from "./personal-playlists.mjs";
import { chainNames, explorers, sourceKind } from "./recovery-model.mjs";
installImageRecovery();
document.querySelectorAll("[data-nav-icon]").forEach((node) => {
  node.innerHTML = navIcon(node.dataset.navIcon);
});
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
  catalogById = new Map(),
  peopleById = new Map(),
  recordsByPerson = new Map(),
  people = [],
  summary = {},
  archive = null,
  filter = "All",
  facets = { network: "", media: "", sort: "archive", collection: "" },
  query = "",
  limit = 40,
  current = null,
  queue = [],
  queueIndex = -1,
  queueMode = null,
  tab = "about",
  ownerCache = new Map(),
  renderVersion = 0,
  playVersion = 0,
  toastTimer;
let queueState = createShuffleQueue();
try {
  queueState = createShuffleQueue(
    localStorage.getItem("mn-archive-shuffle") === "true",
  );
} catch {}
function applyQueueState(next) {
  queueState = next;
  queue = next.ids;
  queueIndex = next.index;
  queueMode = next.mode;
  $("#shuffle").setAttribute("aria-pressed", String(next.enabled));
  $("#shuffle").title = next.enabled ? "Shuffle on" : "Shuffle off";
  warmNextTrack();
}
let likes = new Set();
try {
  likes = new Set(JSON.parse(localStorage.getItem("mn-archive-likes") || "[]"));
  document.documentElement.dataset.theme =
    localStorage.getItem("mn-archive-theme") || "light";
} catch {}
const personalPlaylists = mountPlaylists({
  isLiked: (id) => likes.has(id),
  catalog: () => catalog,
  esc,
  image: (r) => image(r),
  play: (...args) => activateRecording(...args),
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
let audio = $("#audio");
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
  return `<article class="record-card"><div class="cover"><a href="${recordLink(r)}" aria-label="Open ${esc(r.title)}">${img(r)}</a><span class="cover-badge">${esc(platform(r))}${r.mediaScope === "clip" ? " · Clip" : ""}</span>${r.kind !== "artwork" ? `<button class="cover-play" data-play="${esc(r.id)}" aria-label="Play ${esc(r.title)}">▶</button>` : ""}</div><h3><a href="${recordLink(r)}">${esc(cleanTitle(r.title))}</a></h3><div class="card-meta"><a href="#artist/${esc(artistId(r))}">${esc(r.artist)}</a><button class="icon heart ${likes.has(r.id) ? "active" : ""}" data-like="${esc(r.id)}" aria-label="${likes.has(r.id) ? "Unlike" : "Like"} ${esc(r.title)}">${likes.has(r.id) ? "♥" : "♡"}</button></div></article>`;
}
function artistRecords(id) {
  return recordsByPerson.get(id) || [];
}
function person(id) {
  return (
    peopleById.get(id) || {
      id,
      name: artistRecords(id).find((r) => artistId(r) === id)?.artist || id,
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
  const hero = catalogById.get(preferred[0]),
    picks = preferred
      .slice(1, 6)
      .map((id) => catalogById.get(id))
      .filter(Boolean);
  return `<div class="intro"><div><h1>The music remains.</h1><p>A living archive of the music NFT era. Follow the records. Press play.</p></div><span class="live-note"><i class="status-dot"></i> Recovery in progress</span></div><section class="hero" aria-label="Featured recording"><img class="hero-bg" src="${esc(image(hero))}" alt=""><div class="hero-copy"><span class="eyebrow"><i class="status-dot"></i> RECOVERED FROM ETHEREUM + ARWEAVE</span><h2>MIAMI<br>FREESTYLE</h2><p class="artist">CAMPFIRE · Aly, Tarot, Elle Symone, Early & TK</p><div class="hero-actions"><button class="primary" data-play="${hero.id}">▶ &nbsp; Listen now</button><a class="hero-proof" href="${recordLink(hero)}?tab=proof">Follow the onchain record ↗</a></div></div><div class="hero-credit"><span>PEOPLE BEHIND THE RECORD</span><a href="#artist/pete-rango"><div>Pete Rango<small>Mixing & mastering</small></div><img src="/people/pete-rango-160.webp" alt=""></a><a href="#artist/abjo"><div>AbJo<small>Production</small></div>${portrait("abjo") ? `<img src="${esc(portrait("abjo"))}" alt="">` : '<span class="credit-initial" aria-hidden="true">A</span>'}</a></div><img class="hero-waveform" src="/recovered/miami-waveform.svg" alt="Waveform derived from the recovered MIAMI FREESTYLE audio"><div class="hero-bottom"><span>◈ Ethereum &nbsp; → &nbsp; Arweave metadata &nbsp; → &nbsp; Original audio</span><span>The platform went offline.<br>The record is still here.</span></div></section><div class="proof-strip"><span><b>${summary.catalogued}</b> records catalogued &nbsp; · &nbsp; <b>${summary.readable}</b> metadata reads recovered</span><span>${summary.chains.join(" · ")}</span><a href="#recovery">Explore the evidence ↗</a></div><section class="section"><div class="section-head"><div><h2>Back in rotation</h2><p>Original music, recovered through its tokens.</p></div><a class="text-button" href="#explore">Explore all ↗</a></div><div class="cards home-cards">${picks.map(card).join("")}</div></section><section class="section"><div class="section-head"><div><h2>The people who made the era</h2><p>Artists, collaborators, and the work that connects them.</p></div><a class="text-button" href="#artists">Meet everyone ↗</a></div><div class="artist-grid">${featuredArtists.map(artistCard).join("")}</div></section><div class="archive-callout"><div class="archive-symbol">◈</div><div><h3>A platform can disappear. A record can survive.</h3><p>We read the original contracts and follow their metadata to the music. Every recording has a trail you can inspect. Web-archived memories are labeled separately.</p></div><a class="outline-button" href="#recovery">How recovery works ↗</a></div>`;
}
function explore(onlyLikes = false) {
  let list = catalog.filter(
    (r) =>
      (!onlyLikes || likes.has(r.id)) &&
      (filter === "All" ||
        (filter === "Other platforms"
          ? ![
              "Sound",
              "Catalog",
              "Zora",
              "Mint Songs",
              "Supercollector",
            ].includes(platform(r))
          : platform(r) === filter)) &&
      (!facets.network || String(r.chainId) === facets.network) &&
      (!facets.media || r.kind === facets.media) &&
      (!facets.collection || r.collection === facets.collection),
  );
  if (query) {
    const q = query.toLowerCase();
    list = list.filter((r) =>
      [
        r.title,
        r.artist,
        r.searchCredits || "",
        ...(r.personIds || []).flatMap((id) => [
          person(id).name,
          ...(person(id).aliases || []),
        ]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }
  if (["oldest", "newest"].includes(facets.sort))
    list.sort((a, b) => compareReleaseDates(a, b, facets.sort));
  else if (facets.sort !== "archive")
    list.sort(
      (a, b) =>
        (facets.sort === "artist"
          ? a.artist.localeCompare(b.artist)
          : cleanTitle(a.title).localeCompare(cleanTitle(b.title))) ||
        a.id.localeCompare(b.id),
    );
  const select = (name, label, choices) =>
    `<label class="filter-control"><span>${label}</span><select data-facet="${name}" aria-label="${label}">${choices.map(([value, text]) => `<option value="${esc(value)}" ${facets[name] === String(value) ? "selected" : ""}>${esc(text)}</option>`).join("")}</select></label>`;
  const activeFilters =
    filter !== "All" ||
    query ||
    facets.network ||
    facets.media ||
    facets.collection ||
    facets.sort !== "archive";
  const controls = `<div class="filter-toolbar">${select("collection", "Collection", [["", "All collections"], ...[...new Set(catalog.map((r) => r.collection).filter(Boolean))].sort().map((c) => [c, c])])}${select("network", "Network", [["", "All networks"], ...Object.entries(chainNames).filter(([id]) => catalog.some((r) => String(r.chainId) === id))])}${select(
    "media",
    "Media",
    [
      ["", "All media"],
      ["audio", "Audio"],
      ["video", "Video"],
    ],
  )}${select("sort", "Sort", [
    ["archive", "Featured order"],
    ["newest", "Newest first"],
    ["oldest", "Oldest first"],
    ["title", "Title A–Z"],
    ["artist", "Artist A–Z"],
  ])}</div>${activeFilters ? '<div class="filter-reset"><button class="text-button" data-clear-filters>Reset filters</button></div>' : ""}`;
  return `<div class="intro"><div><h1>${onlyLikes ? "Liked sounds" : query ? "Search the archive" : "Explore the archive"}</h1><p>${onlyLikes ? "Your selections, saved in this browser." : query ? `Results for “${esc(query)}”` : "Find songs, artists, and collections from the web3 music era"}</p></div></div><div class="filters">${["All", "Sound", "Catalog", "Zora", "Mint Songs", "Supercollector", "Other platforms"].map((f) => `<button class="chip ${filter === f ? "active" : ""}" data-filter="${f}" aria-pressed="${filter === f}">${f}</button>`).join("")}<span class="results">${list.length.toLocaleString()} records</span></div>${controls}${["oldest", "newest"].includes(facets.sort) ? '<p class="sort-date-note">Sorted by token or release-contract creation. Undated recordings appear last.</p>' : ""}${list.length ? `<div class="cards library-grid">${list.slice(0, limit).map(card).join("")}</div>${list.length > limit ? '<button class="outline-button more" data-more>Load more recordings</button>' : ""}` : `<div class="empty"><h2>${onlyLikes ? "Make yourself a collection." : "No recordings found."}</h2>${onlyLikes ? "Tap the heart on any recording to keep it here." : "Try another artist, title, or platform."}</div>`}`;
}
function artists() {
  const ids = [
    ...new Set([...featuredArtists, ...catalog.map(artistId)]),
  ].filter(
    (id) =>
      artistRecords(id).length &&
      (!artistQuery ||
        [person(id).name, ...(person(id).aliases || [])].some((name) =>
          name.toLowerCase().includes(artistQuery.toLowerCase()),
        )),
  );
  return `<div class="intro"><div><h1>Artists</h1><p>The people behind the records. Credits are preserved where documented.</p></div></div><label class="artist-search-label">Find an artist<input id="artist-search" type="search" placeholder="Search artist names…" value="${esc(artistQuery)}"></label><p class="link-note">${ids.length} artists</p><div class="artist-grid section">${ids.slice(0, artistLimit).map(artistCard).join("")}</div>${ids.length > artistLimit ? '<button class="outline-button more" data-more-artists>Load more artists</button>' : ""}`;
}
function artistLinks(p) {
  return `${p.portrait ? `<a class="link-note" href="${esc(p.portrait.source)}" target="_blank" rel="noopener noreferrer">Image: ${esc(p.portrait.credit || p.portrait.note || "Profile source")} ↗</a>` : ""}<div class="artist-links">${(p.links || []).map((l) => `<a class="outline-button" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)} ↗</a>${l.source ? `<a class="link-note" href="${esc(l.source)}" target="_blank" rel="noopener noreferrer">${esc(l.capturedAt)} source ↗</a>` : ""}`).join("")}</div>${p.links?.length ? '<small class="link-note">Links preserved from research or archived artist profiles; current account ownership has not been reverified.</small>' : ""}${p.sources?.length ? `<details class="artist-sources"><summary>Artist sources & historical context (${p.sources.length})</summary>${p.sources.map((s) => `<p><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a><small>${esc(s.kind)} · ${esc(s.date)}</small></p>`).join("")}</details>` : ""}`;
}
const artistRecordLimits = new Map();
function artistPage(id) {
  const p = person(id),
    list = artistRecords(id),
    shown = artistRecordLimits.get(id) || 40;
  return `<a class="back" href="#artists">← All artists</a><section class="artist-identity ${p.banner ? "has-banner" : ""}">${p.banner ? `<img class="artist-banner" src="${esc(p.banner.src)}" alt="${esc(p.name)} historical profile banner">` : ""}<div class="artist-identity-row"><div class="artist-identity-avatar">${portraitMarkup(id)}</div><div class="artist-identity-name"><span class="eyebrow">${id === "pete-rango" ? "PRODUCER · MIXING · MASTERING" : esc(p.kind || "Artist")}</span><h1>${esc(p.name)}</h1></div><div class="artist-stat"><strong>${list.length}</strong><span>Recovered recordings</span></div></div><div class="artist-identity-bio"><p>${esc(p.bio || "Artist attribution preserved from the recovered recordings.")}</p>${p.banner ? `<a class="link-note" href="${esc(p.banner.source)}" target="_blank" rel="noopener noreferrer">Profile banner · ${esc(p.banner.capturedAt)} capture ↗</a>` : ""}${artistLinks(p)}</div></section><div class="section-head"><h2>${id === "pete-rango" ? "On the credits" : "In the archive"}</h2><span class="tag">${list.length} recordings</span></div><div class="cards library-grid">${list.slice(0, shown).map(card).join("")}</div>${list.length > shown ? `<button class="outline-button more" data-more-artist-records="${esc(id)}">Load more recordings</button>` : ""}${artistComments(list)}`;
}
function mediaLabel(r) {
  return r.recovery?.mediaSourceType === "archived-sound-cdn"
    ? "Archived Sound CDN audio"
    : r.recovery?.mediaSourceType === "spinamp-preserved-audio"
      ? "Spinamp preserved audio"
      : r.recovery?.mediaSourceType === "indexed-nft-media"
        ? "Indexed NFT media"
        : "Original media";
}
function proof(r) {
  const v = r.recovery;
  const explorer = explorers[r.chainId];
  const spinampSource = v?.sourceType?.startsWith("spinamp-");
  const indexedSource = spinampSource
    ? "Spinamp’s public music index"
    : r.platform === "Catalog"
      ? "Catalog’s official March 9, 2026 index export"
      : v?.sourceName ||
        v?.indexedSource ||
        "a preserved public metadata snapshot";
  const indexedURL = spinampSource
    ? v.source
    : r.platform === "Catalog"
      ? "https://github.com/catalogworks/catalog-squidward-data"
      : v?.sourceURL || v?.indexedSourceURL || v?.source;
  const chainURI = ["mismatch", "template-matches-index"].includes(
    v?.contractURIRead?.status,
  )
    ? v.contractURIRead
    : null;
  const chainNotice = chainURI
    ? `<div class="notice" data-contract-uri-status="${esc(chainURI.status)}"><strong>${chainURI.status === "mismatch" ? "Current contract metadata differs from the published index." : "Contract URI template matches the published index."}</strong><p>${chainURI.status === "mismatch" ? "Playback and release details here follow the platform’s preserved mapping. The current contract URI does not match that metadata path; this is not a verified current token metadata read." : "The URI template returned by the contract matches this index entry. Resolving every token’s current metadata and checking its audio are separate steps."}</p><p>Read at block ${esc(chainURI.blockNumber)} · Current contract URI:</p><code>${esc(chainURI.value)}</code>${indexedURL?.startsWith("https://") ? `<p><a href="${esc(indexedURL)}" target="_blank" rel="noopener noreferrer">Published release source ↗</a></p>` : ""}</div>`
    : "";
  const coin = r.standard === "ERC20";
  return `<div class="reading"><h2>Follow the surviving record</h2>${v?.status === "indexed" ? `<p class="notice">Metadata and media references come from ${esc(indexedSource)}. A current contract read is tracked separately. ${indexedURL?.startsWith("https://") ? `<a href="${esc(indexedURL)}" target="_blank" rel="noopener noreferrer">Published source ↗</a>` : ""}</p>` : ""}<p>${v?.mediaSourceType === "spinamp-preserved-audio" ? (v.originalMediaMissing === false ? "The NFT metadata retains an original media reference. Playback here uses audio preserved separately by Spinamp because that original source is not supported by this player." : "Spinamp preserved this audio separately from the NFT metadata, which had no original media reference in the indexed snapshot.") + " The audio may be transcoded. The token identity and metadata mapping come from Spinamp’s index and are not independently verified onchain here." : v?.status === "indexed" ? "The platform’s published index preserves the token mapping, metadata path, and audio reference. Contract verification is tracked separately below." : v?.chainMetadataHasMedia === false ? "The contract identifies this release, but its current metadata has empty audio fields. A matching archived Sound page preserved the Sound CDN transcode used for playback." : "The blockchain stores the token and its metadata reference. The recording is retrieved from the storage that reference identifies. This path does not depend on Sound’s API."}</p></div>${chainNotice}<div class="provenance"><div class="proof-step"><span class="step-num">1</span><div><h3>${chainNames[r.chainId]} · Original contract</h3><code>${esc(r.contract)}</code><p>${coin ? "ERC-20 content coin · contractURI()" : `Token ID ${esc(r.tokenId)}`}${v?.blockNumber ? ` · Read at block ${v.blockNumber.toLocaleString()}` : ""}</p></div><a href="${explorer}/token/${r.contract}${coin ? "" : `?a=${r.tokenId}`}" target="_blank" rel="noopener noreferrer">Inspect token ↗</a></div><div class="proof-step"><span class="step-num">2</span><div><h3>${["live", "indexed"].includes(v?.status) ? sourceKind(v.metadataURI || v.metadataURL) + " · Metadata" : "Metadata reference"}</h3><code>${esc(["live", "indexed"].includes(v?.status) ? (v.metadataURI?.startsWith("data:") ? "JSON returned directly by the contract" : v.metadataURI || v.metadataURL) : "Read the contract to resolve its metadata.")}</code><p>${v?.status === "live" ? "The token’s metadata links to the original media." : v?.status === "indexed" ? "The published index preserves this metadata reference." : "No successful current recovery is recorded yet."}</p></div>${v?.metadataURL ? `<a href="${esc(v.metadataURL)}" target="_blank" rel="noopener noreferrer">Open metadata ↗</a>` : ""}</div><div class="proof-step"><span class="step-num">3</span><div><h3>${v?.mediaURI ? sourceKind(v.mediaURI) + " · " + mediaLabel(r) : mediaLabel(r)}</h3><code>${esc(v?.mediaURI || "Unresolved")}</code><p>${v?.mediaSourceType === "spinamp-preserved-audio" ? "Audio preserved by Spinamp; it may be transcoded and is not the original audio URI from the token metadata." : v?.mediaSourceType === "indexed-nft-media" ? "Media linked through Spinamp’s NFT index. This mapping has not been independently checked against the current contract." : v?.mediaSourceType === "archived-sound-cdn" ? "This is Sound’s hosted transcode recovered from an archived page, not the original audio URL in current contract metadata." : "Audio is stored separately from token ownership. Availability depends on the storage network."}</p></div>${v?.mediaURL ? `<a href="${esc(v.mediaURL)}" target="_blank" rel="noopener noreferrer">${v?.mediaSourceType === "spinamp-preserved-audio" ? "Open Spinamp audio" : v?.mediaSourceType === "indexed-nft-media" ? "Open indexed media" : v?.mediaSourceType === "archived-sound-cdn" ? "Open recovered audio" : "Open original"} ↗</a>` : ""}</div></div><button class="outline-button" data-recover="${r.id}">↻ Read the contract again</button><div class="notice" id="verify-status">${v?.status === "live" ? `Last successful metadata recovery: ${esc(v.checkedAt)}. Playback is verified separately when you listen.` : v?.status === "indexed" ? "Recovered from a preserved public index; playback and current contract verification are checked separately." : "This record has a known token reference. Its metadata has not been successfully recovered in this pass."}</div>`;
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
  const facts = r.musicFacts || musicFacts(r);
  if (!facts.bpm && !facts.key) return "";
  return `<div class="music-facts" aria-label="Recovered music details">${facts.bpm ? `<span class="tag">${facts.source.startsWith("BPM estimated") ? "~" : ""}${facts.bpm} BPM</span>` : ""}${facts.key ? `<span class="tag">${esc(facts.key)}</span>` : ""}<small class="link-note">${esc(facts.source)}</small></div>`;
}
function metadataCredits(r) {
  const data = r.musicMetadata;
  if (!data) return "";
  const details = Object.entries(data.details || {}).filter(
    ([key]) => !["Description", "Lyrics"].includes(key),
  );
  const publicRelease = data.sourceType === "official-public-release-page";
  const indexedMetadata = data.sourceType === "spinamp-indexed-metadata";
  const metadataSourceURL =
    publicRelease || indexedMetadata ? data.source : data.metadataURL;
  return `${data.collaborators.length || data.credits.length ? `<h2>Original credits</h2>${data.collaborators.length ? `<p>${esc(data.collaborators.join(" · "))}</p>` : ""}${data.credits.map((credit) => `<p>${esc(credit)}</p>`).join("")}` : ""}${details.length ? `<details class="artist-sources"><summary>More about this recording</summary><dl>${details.map(([label, values]) => `<dt>${esc(label)}</dt><dd>${esc(values.join(" · "))}${label === "Duration" ? " seconds" : ""}</dd>`).join("")}</dl></details>` : ""}${renderLyrics(r, esc)}${metadataSourceURL ? `<a class="link-note" href="${esc(metadataSourceURL)}" target="_blank" rel="noopener noreferrer">${publicRelease ? "Official public release page" : indexedMetadata ? "Spinamp indexed metadata" : data.snapshotDate ? "Metadata saved by Catalog" : "Original token metadata"} ↗</a>` : ""}`;
}
function songRevenue(r) {
  const revenue = r.revenue;
  if (!revenue) return "";
  return `<section class="song-revenue"><h2>Support for this release</h2><p><strong>${esc(revenue.artistPaid)} USDC</strong> in verified artist payouts</p><p>${esc(revenue.gross)} USDC in recorded purchases · ${revenue.purchaseCount} purchase${revenue.purchaseCount === 1 ? "" : "s"}</p><details class="artist-sources"><summary>Payments and sources</summary><p>Catalog’s March 9, 2026 export, checked against USDC transfers on Base. Partial recovery: includes only Base token purchases whose receipts and artist transfers were verified; album purchases, resales, and later activity are not included. Artist payouts can go to a collaborator split contract. This is not lifetime income or the artist’s personal take-home pay.</p><p>Platform: ${esc(revenue.platformPaid)} USDC · Referrals: ${esc(revenue.referralsPaid)} USDC</p>${revenue.events.map((event) => `<p><a href="https://basescan.org/tx/${esc(event.transaction)}" target="_blank" rel="noopener noreferrer">${esc(event.date.slice(0, 10))} · ${esc(event.gross)} USDC purchase ↗</a></p>`).join("")}<a href="https://github.com/catalogworks/catalog-squidward-data" target="_blank" rel="noopener noreferrer">Catalog’s original export ↗</a></details></section>`;
}

const fullRecordIds = new Set(),
  recordRequests = new Map(),
  recordErrors = new Set();
function recordDetailsStatus(r) {
  return recordErrors.has(r.id)
    ? `<div class="reading"><p class="notice" role="alert">Recording details could not load. You can still play the music.</p><button class="outline-button" data-retry-record="${esc(r.id)}">Retry details ↻</button></div>`
    : '<div class="reading"><p class="notice" role="status">Loading recording details…</p></div>';
}
function refreshRecordPanel(id) {
  if (location.hash.split("?")[0] !== recordLink({ id })) return;
  const panel = main.querySelector('[role="tabpanel"]');
  if (!panel) return;
  const y = scrollY;
  const template = document.createElement("template");
  template.innerHTML = recordPage(id);
  panel.replaceChildren(
    ...template.content.querySelector('[role="tabpanel"]').childNodes,
  );
  window.scrollTo({ top: y, behavior: "instant" });
  if (fullRecordIds.has(id)) collectors.load(id);
}
async function loadRecordDetails(id, retry = false) {
  if (
    fullRecordIds.has(id) ||
    recordRequests.has(id) ||
    (recordErrors.has(id) && !retry)
  )
    return;
  const r = catalogById.get(id);
  if (!r) return;
  recordErrors.delete(id);
  const recoveryBefore = r.recovery;
  const request = fetch("/api/record/" + encodeURIComponent(id), {
    signal: AbortSignal.timeout(20000),
  });
  recordRequests.set(id, request);
  if (retry) refreshRecordPanel(id);
  try {
    const response = await request;
    if (!response.ok) throw Error("Recording unavailable");
    const { record } = await response.json();
    if (record?.id !== id) throw Error("Unexpected recording");
    // A user-triggered contract read may finish while details are downloading.
    const recovery =
      r.recovery !== recoveryBefore ? r.recovery : record.recovery;
    Object.assign(r, record, { recovery });
    delete r.musicFacts; // Full details may contain newer metadata or analysis than the index.
    fullRecordIds.add(id);
  } catch {
    recordErrors.add(id);
  } finally {
    recordRequests.delete(id);
    refreshRecordPanel(id);
  }
}
document.addEventListener("click", (event) => {
  const retry = event.target.closest("[data-retry-record]");
  if (retry) loadRecordDetails(retry.dataset.retryRecord, true);
});
function recordPage(id) {
  const r = catalogById.get(id);
  if (!r)
    return '<div class="empty">Recording not found. <a href="#explore">Browse the archive.</a></div>';
  return `<a class="back" href="#explore">← Explore the archive</a><section class="record-head"><div class="cover">${img(r)}</div><div><span class="eyebrow">${esc(platform(r))} · ${chainNames[r.chainId]} · ${r.kind === "artwork" ? "ARTWORK COLLECTIBLE" : r.mediaScope === "clip" ? "VIDEO CLIP" : r.kind === "video" ? "VIDEO" : "RECORDING"}</span><h1>${esc(cleanTitle(r.title))}</h1><p><a href="#artist/${artistId(r)}">${esc(r.artist)}</a></p><div class="actions">${r.kind === "artwork" ? `<p class="notice">This token points to artwork. No separate audio was identified in its metadata.</p>` : `<button class="primary" data-play="${r.id}">▶ &nbsp; Listen now</button><button class="outline-button" data-queue="${r.id}">＋ Add to queue</button><button class="outline-button" data-add-playlist="${r.id}">＋ Add to playlist</button>`}<button class="icon heart ${likes.has(r.id) ? "active" : ""}" data-like="${r.id}" aria-label="Like recording">${likes.has(r.id) ? "♥" : "♡"}</button></div></div></section><div class="tabs" role="tablist" aria-label="Recording details">${[
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
    )}</div><div role="tabpanel">${!fullRecordIds.has(r.id) ? recordDetailsStatus(r) : tab === "comments" ? songComments(r) : tab === "proof" ? proof(r) : tab === "collectors" ? (r.standard === "ERC20" ? collectors.panel(r, true) : `${collectors.panel(r, true)}<details class="ownership-tools"><summary>Additional ownership tools</summary><div class="reading"><h2>Who holds this edition?</h2><p>Read the owner of token ${r.tokenId} directly from ${chainNames[r.chainId]}. This is the current holder of one edition, not a complete collector list or proof of who originally minted it.</p></div><div id="owner-result"><button class="outline-button" data-owner="${r.id}">Read owner from the blockchain ↗</button></div><div class="reading"><h2>Contract holders</h2><p>Current balances reported by the chain indexer. A contract may contain multiple songs; these holders are not automatically collectors of this particular track. ENS labels are current indexer data.</p></div><button class="outline-button" data-holders="${r.id}">Load indexed holders</button><div id="holders-result"></div><div class="notice">Full mint-history reconstruction is still in progress. Today’s owner is not necessarily the original supporter.</div></details>`) : `<div class="reading"><h2>Behind the music</h2>${musicFactBadges(r)}${(r.musicMetadata?.details?.Description || []).map((text) => `<p class="original-release-notes">${esc(text)}</p>`).join("")}${r.credits?.length ? `<h2>Credits</h2>${r.credits.map((c) => `<p><a href="#artist/${c.personId}">${esc(person(c.personId).name)}</a> — ${esc(c.role)}${c.source ? ` · <a class="link-note" href="${esc(c.source)}" target="_blank" rel="noopener noreferrer">Credit source ↗</a>` : ""}</p>`).join("")}` : ""}${metadataCredits(r)}${r.archivedCredits?.length ? `<h2>Credits preserved from Sound</h2>${r.archivedCredits.map((credit) => `<p>${esc(credit)}</p>`).join("")}<a class="link-note" href="${esc(r.archivedCreditsSource)}" target="_blank" rel="noopener noreferrer">Archived credit source ↗</a>` : ""}${r.releaseDate ? `<p class="release-date">${esc(r.releaseDate.label)} · <time datetime="${esc(r.releaseDate.date)}">${esc(date(r.releaseDate.date))}</time>${r.releaseDate.source ? ` · <a class="link-note" href="${esc(r.releaseDate.source)}" target="_blank" rel="noopener noreferrer">Date source ↗</a>` : ""}</p>` : ""}${songRevenue(r)}${renderRoyaltyPayments(r, esc)}<h2>Preservation notes</h2><p>${r.standard === "ERC20" ? "This media was referenced by a Zora content coin. Coin balances are not NFT edition counts; the recovered clip is not the complete song." : "This archive holds a selected token reference for this work. A single recording can have many editions, and a contract can hold multiple works. The catalog is a starting point for recovery, not a claim of completeness."}</p>${r.originalRelease ? `<p><a class="error-link" href="https://web.archive.org/web/*/${esc(r.originalRelease)}" target="_blank" rel="noopener noreferrer">Find the original release in the Internet Archive ↗</a></p>` : ""}<p><a class="error-link" href="${recordLink(r)}?tab=proof">Inspect the contract and original storage addresses ↗</a></p></div>${collectors.panel(r, true)}`}</div>`;
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
  return `<div class="intro"><div><h1>The recovery ledger</h1><p>Evidence you can follow. Gaps you can see. Nothing silently filled in.</p></div><a class="outline-button" href="/api/manifest" download>↓ Export evidence</a></div><div class="stats-grid"><div class="stat"><strong>${summary.catalogued}</strong><span>Catalogued records</span></div><div class="stat"><strong>${summary.readable}</strong><span>Metadata recovered through contracts</span></div><div class="stat"><strong>${summary.unavailable}</strong><span>Reads unavailable · retryable</span></div><div class="stat"><strong>${summary.notAttempted}</strong><span>Awaiting this recovery pass</span></div><div class="stat"><strong>${summary.indexed || 0}</strong><span>Preserved index metadata · current read tracked separately</span></div></div><div class="reading"><p><a class="error-link" href="#community">Browse the complete archived comment evidence ↗</a></p><h2>What this proves</h2><p>A token can outlive the interface that sold it. We query its original contract, recover its metadata, and resolve the media it points to. Ownership lives onchain; audio usually lives on Arweave or IPFS. Neither a working metadata link nor an old capture guarantees every file remains playable.</p><h2>What this doesn’t claim</h2><p>The NFT Era catalog is now expanded with releases recovered from Sound factory events and legacy edition registries. The census below states the scanned scope; it does not imply that every recording, historical collector, profile, or comment has been recovered. Sound deployment discovery includes Ethereum and Optimism; Base and Zora are also supported for the broader music NFT catalog. Each token is identified by chain, contract, and token ID.</p></div>${catalogCoverageView()}${coverageView()}<div class="source-legend"><span><b>◈ Blockchain</b> · token, owner, metadata reference</span><span><b>↗ Storage</b> · audio, artwork, metadata</span><span><b>◌ Web archive</b> · captured social context</span></div><div class="section-head"><h2>Recording-level evidence</h2><button class="text-button" data-refresh>↻ Refresh recovery status</button></div><div class="table-wrap"><table class="ledger"><thead><tr><th>Recording</th><th>Network</th><th>Media storage</th><th>Metadata read</th><th>Evidence</th></tr></thead><tbody>${catalog
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
function playlists(id) {
  if (!archive) return '<div class="loading">Loading the archive…</div>';
  const lists = archive.playlists?.length
    ? archive.playlists
    : [archive.playlist];
  const p = lists.find((item) => item.id === id) || lists[0],
    known = p.tracks.filter((t) => !t.missing),
    recoveredIDs = p.tracks
      .map((t) => !t.missing && matchTrack(t)?.id)
      .filter(Boolean);
  return `<div class="intro"><div><h1>Playlists from the era</h1><p>Preserving the selections people made, with their original attribution.</p></div></div><div class="filters historical-playlist-picker" aria-label="Historical playlists">${lists.map((item) => `<a class="chip ${item.id === p.id ? "active" : ""}" href="#historic-playlists/${esc(item.id)}" ${item.id === p.id ? 'aria-current="page"' : ""}>${esc(item.name)}</a>`).join("")}</div><section class="playlist-feature"><div class="collage">${known
    .slice(0, 4)
    .map(
      (t) =>
        `<img src="${esc(matchTrack(t) ? image(matchTrack(t)) || t.coverURL : t.coverURL)}" alt="${esc(t.title)} artwork">`,
    )
    .join(
      "",
    )}</div><div><span class="eyebrow">WEB ARCHIVE · ${esc(date(p.capturedAt))}</span><h2>${esc(p.name)}</h2><p>By ${esc(p.curator)} · ${p.declaredCount} original tracks<br>${esc(p.description)}</p><p>${known.length} track details recovered · ${p.tracks.length - known.length} track IDs still unresolved</p><a class="text-button error-link" href="${p.source}" target="_blank" rel="noopener noreferrer">Open the original capture ↗</a></div></section>${personalPlaylists.actionsForSnapshot("historic-" + p.id, { name: p.name, recordIds: recoveredIDs })}<p class="link-note">${recoveredIDs.length} tracks matched for playback. Saved copies include these recovered tracks in their original order.</p><div class="notice">This playlist was preserved in historical Sound pages, with its original order and curator. We recovered ${known.length} of ${p.tracks.length} track details from the page and its embedded activity.${known.length < p.tracks.length ? " Unresolved entries remain visible in their original positions." : ""} These are web-archive records, separate from the onchain music references. Playback and saved copies use verified catalog matches.</div>${p.tracks
    .map((t) => {
      const r = !t.missing && matchTrack(t);
      return `<div class="track-row personal-track"><span class="index">${t.index + 1}</span>${!t.missing ? `<img src="${esc(matchTrack(t) ? image(matchTrack(t)) || t.coverURL : t.coverURL)}" alt=""><div><strong>${esc(t.title)}</strong><small>${esc(t.artist)}${t.source ? ` · <a href="${esc(t.source)}" target="_blank" rel="noopener noreferrer">Recovered detail source ↗</a>` : ""}</small></div>` : `<div><strong>Track details not yet recovered</strong><small>Preserved track ID: ${esc(t.id)}</small></div>`}<div class="playlist-track-actions">${r ? `<button class="icon" data-play="${r.id}" aria-label="Play ${esc(r.title)}">${navIcon("play")}</button>${personalPlaylists.likeButton(r)}<button class="icon" data-add-playlist="${r.id}" aria-label="Add ${esc(r.title)} to playlist">＋</button>` : "<span>Awaiting token match</span>"}</div></div>`;
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
                        : view === "shared-playlist"
                          ? personalPlaylists.sharedView(id)
                          : view === "playlist"
                            ? personalPlaylists.view(id)
                            : view === "historic-playlists"
                              ? playlists(id)
                              : view === "community"
                                ? community()
                                : home();
  preloader.cancel();
  requestAnimationFrame(warmVisibleTrack);
  document.dispatchEvent(new Event("mn:route"));
  if (view === "record")
    queueMicrotask(() => {
      const recordId = decodeURIComponent(id || "");
      if (fullRecordIds.has(recordId)) collectors.load(recordId);
      else loadRecordDetails(recordId);
    });
  if (view === "collector" && !collectors.hasProfile(id))
    queueMicrotask(() => collectors.loadProfile(id));
  $("#liked-count").textContent = likes.size;
  document.title =
    (view === "record"
      ? cleanTitle(catalogById.get(id)?.title || "Recording")
      : "The music remains.") + " — Music Nerd";
}
async function loadCatalog() {
  const res = await fetch("/api/catalog?view=index");
  if (!res.ok) throw Error("Catalog unavailable");
  const d = await res.json();
  catalog = d.records;
  people = d.people;
  catalogById = new Map(catalog.map((record) => [record.id, record]));
  peopleById = new Map(people.map((person) => [person.id, person]));
  recordsByPerson = new Map();
  for (const record of catalog) {
    const ids = new Set([
      artistId(record),
      ...(record.personIds || []),
      ...(record.credits || []).map((credit) => credit.personId),
    ]);
    for (const id of ids) {
      if (!id) continue;
      const records = recordsByPerson.get(id) || [];
      records.push(record);
      recordsByPerson.set(id, records);
    }
  }
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
  wantsPlayback = false,
  startingPlayback = false;
let preloader = createMediaPreloader(audio, {
  isBusy: () => !!current || wantsPlayback,
});
const nextTrackBuffer = createNextTrackBuffer({
  canWarm: () =>
    !!current &&
    wantsPlayback &&
    hasPlaybackHeadroom(audio) &&
    current.kind !== "video",
});
function warmNextTrack() {
  const id = queue[queueIndex + 1];
  const r = catalogById.get(id);
  if (!r || !["live", "indexed"].includes(r.recovery?.status)) {
    nextTrackBuffer.cancel();
    return;
  }
  nextTrackBuffer.schedule({
    id,
    kind: r.kind,
    url: r.playback?.workingURL || r.recovery.mediaURL,
    contextId: String(queueState.entries[queueIndex]?.key ?? current?.id ?? ""),
  });
}
let nowPlaying;
let mediaSessionRecordId;
let mediaEvents;
function adoptBufferedMedia(warmed) {
  const old = audio;
  preloader.dispose();
  mediaEvents?.abort();
  old.removeAttribute("id");
  warmed.id = "audio";
  warmed.className = old.className;
  warmed.setAttribute("playsinline", "");
  warmed.volume = old.volume;
  warmed.muted = old.muted;
  warmed.playbackRate = old.playbackRate;
  old.replaceWith(warmed);
  audio = warmed;
  bindPlayerEvents();
  preloader = createMediaPreloader(audio, {
    isBusy: () => !!current || wantsPlayback,
  });
  old.removeAttribute("src");
  old.preload = "none";
  old.load();
}
function warmTrack(id) {
  const r = catalogById.get(id);
  if (!r || !["live", "indexed"].includes(r.recovery?.status)) return;
  preloader.schedule({
    id,
    kind: r.kind,
    url: r.playback?.workingURL || r.recovery.mediaURL,
  });
}
function warmVisibleTrack() {
  const button = [...main.querySelectorAll("[data-play]")].find((node) => {
    const box = node.getBoundingClientRect();
    return (
      box.bottom > 0 &&
      box.top < innerHeight &&
      box.width > 0 &&
      catalogById.get(node.dataset.play)?.kind === "audio"
    );
  });
  if (button) warmTrack(button.dataset.play);
}
for (const event of ["pointerover", "focusin"])
  main.addEventListener(event, (e) => {
    const button = e.target.closest("[data-play]");
    if (button) warmTrack(button.dataset.play);
  });
function automaticQueueFor(record) {
  let ids = [
    ...new Set(
      [...main.querySelectorAll("[data-play]")].map(
        (node) => node.dataset.play,
      ),
    ),
  ];
  if (ids.length <= 1) ids = artistRecords(artistId(record)).map((r) => r.id);
  if (ids.length <= 1)
    ids = [
      record.id,
      ...preferred,
      ...catalog
        .filter((r) => platform(r) === platform(record))
        .slice(0, 40)
        .map((r) => r.id),
    ];
  return [...new Set(ids)]
    .filter((id) => catalog.some((r) => r.id === id && r.kind !== "artwork"))
    .slice(0, 200);
}
async function play(id, list = null, index = null) {
  const r = catalogById.get(id);
  if (!r || r.kind === "artwork") return;
  const version = ++playVersion;
  startingPlayback = true;
  mediaRecovery?.dispose();
  clearTimeout(mediaTimer);
  wantsPlayback = true;
  const warmed = nextTrackBuffer.take(
    id,
    r.playback?.workingURL || r.recovery?.mediaURL,
  );
  audio.pause();
  if (warmed) adoptBufferedMedia(warmed);
  const nextQueue = selectShuffledTrack(
    queueState,
    id,
    automaticQueueFor(r),
    list,
    index,
  );
  applyQueueState(nextQueue);
  current = r;
  syncPlaybackControls();
  if ($("#queue-dialog").open) showQueue();
  document.body.classList.add("has-player");
  $("#player").hidden = false;
  $("#player-title").textContent = cleanTitle(r.title);
  $("#player-artist").textContent = r.artist;
  $("#player-art").src = image(r);
  $("#player-source").textContent = `${mediaLabel(r)} · Loading…`;
  syncPlaybackControls();
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
        startingPlayback = false;
        wantsPlayback = false;
        syncPlaybackControls();
        $("#player-source").textContent =
          "Recovery unavailable — retry from Provenance";
        $("#toggle").innerHTML = navIcon("play");
        notify(
          "The original metadata could not be reached. You can retry from Provenance.",
        );
      }
      return;
    }
  }
  if (version !== playVersion) return;
  const mediaURL = r.playback?.workingURL || v.mediaURL;
  if ((!warmed || audio.src !== mediaURL) && !preloader.take(id, mediaURL))
    audio.src = mediaURL;
  const exhausted = () => {
    if (version !== playVersion) return;
    clearTimeout(mediaTimer);
    wantsPlayback = false;
    startingPlayback = false;
    audio.pause();
    syncPlaybackControls();
    $("#player-source").textContent =
      `${mediaLabel(r)} unavailable — press play to retry`;
    notify("This recording’s media could not be played. You can retry.");
  };
  mediaRecovery = createMediaRecovery(audio, {
    originalURL: r.playback?.workingURL || v.mediaURL,
    shouldPlay: () => wantsPlayback && version === playVersion,
    onSwitch: () => {
      $("#player-source").textContent =
        "Retrying the same IPFS content through another gateway…";
      clearTimeout(mediaTimer);
      mediaTimer = setTimeout(() => {
        if (version === playVersion && audio.currentTime === 0 && wantsPlayback)
          mediaRecovery.recoverSlow();
      }, 18000);
    },
    onExhausted: exhausted,
    onSlow: () => {
      if (version === playVersion)
        $("#player-source").textContent =
          `${mediaLabel(r)} is taking longer to load…`;
    },
  });
  mediaTimer = setTimeout(() => {
    if (version === playVersion && audio.currentTime === 0 && wantsPlayback)
      mediaRecovery.recoverSlow();
  }, 12000);
  $("#player-source").textContent =
    `${chainNames[r.chainId]} → ${sourceKind(v.mediaURI)} · ${mediaLabel(r)}`;
  $("#player-like").textContent = likes.has(id) ? "♥" : "♡";
  startingPlayback = false;
  syncPlaybackControls();
  if (!wantsPlayback) return;
  try {
    await audio.play();
  } catch (error) {
    if (
      error.name !== "AbortError" &&
      wantsPlayback &&
      version === playVersion &&
      !audio.error
    ) {
      wantsPlayback = false;
      syncPlaybackControls();
      if (error.name === "NotAllowedError") {
        clearTimeout(mediaTimer);
        wantsPlayback = false;
        $("#player-source").textContent = "Ready — press play to continue";
        notify("Press play to continue this recording.");
      } else {
        notify(
          "Playback could not start. Press play to retry; the media may be unavailable.",
        );
      }
    }
  }
}
function showQueue() {
  queueSorting.cancel();
  const list = $("#queue-list");
  $("#queue-context").textContent = queue.length
    ? queueMode === "auto"
      ? "Your browsing selection · Drag handles to reorder"
      : "Your listening order · Drag handles to reorder"
    : "Choose a recording to start a new queue.";
  $("#clear-queue").disabled = !queue.length;
  list.innerHTML = queue.length
    ? queue
        .map((id, i) => {
          const r = catalogById.get(id);
          if (!r) return "";
          return `<div class="queue-item ${i === queueIndex && current?.id === id ? "current" : ""}" data-queue-key="${queueState.entries[i].key}"><button class="icon queue-drag-handle" type="button" data-queue-drag aria-label="Move ${esc(cleanTitle(r.title))}, position ${i + 1} of ${queue.length}. Use Arrow Up or Arrow Down to reorder." aria-keyshortcuts="ArrowUp ArrowDown" title="Drag to reorder">${navIcon("grip")}</button><span class="queue-position">${i + 1}</span><img src="${esc(image(r))}" alt=""><div>${esc(cleanTitle(r.title))}<small>${esc(r.artist)}</small></div><button class="icon" data-queue-play="${i}" data-play-record="${esc(id)}" aria-label="Play ${esc(r.title)}">${navIcon("play")}</button><button class="icon" data-queue-remove="${i}" aria-label="Remove ${esc(r.title)} from queue">×</button></div>`;
        })
        .join("")
    : '<div class="empty">Your queue is clear. The current recording will keep playing.</div>';
  syncPlaybackControls();
  if (!$("#queue-dialog").open) $("#queue-dialog").showModal();
}

const queueSorting = mountQueueSortable($("#queue-list"), {
  announce: notify,
  onMove: (key, to, inputType) => {
    const from = queueState.entries.findIndex(
      (entry) => String(entry.key) === key,
    );
    const next = moveShuffleQueue(queueState, from, to);
    if (next === queueState) return;
    applyQueueState(next);
    showQueue();
    $("#queue-list")
      .querySelector(`[data-queue-key="${key}"] [data-queue-drag]`)
      ?.focus({ preventScroll: inputType !== "keyboard" });
    notify(
      `Moved to position ${to + 1}. Your order is kept when shuffle is off.`,
    );
  },
});

document.addEventListener("click", async (e) => {
  const el = e.target.closest("button,a");
  if (!el) return;
  if (el.dataset.play) {
    activateRecording(el.dataset.play);
    return;
  }
  if (el.dataset.like) {
    toggleLike(el.dataset.like);
    return;
  }
  if (el.dataset.queue) {
    applyQueueState(appendShuffleQueue(queueState, el.dataset.queue));
    notify("Added to your listening queue");
    return;
  }
  if (el.dataset.queueRemove !== undefined) {
    const next = removeShuffleQueue(queueState, Number(el.dataset.queueRemove));
    applyQueueState(next);
    showQueue();
    return;
  }
  if (el.id === "clear-queue") {
    applyQueueState(clearShuffleQueue(queueState));
    showQueue();
    notify("Queue cleared. Your current recording keeps playing.");
    return;
  }
  if (el.dataset.queuePlay !== undefined) {
    const i = Number(el.dataset.queuePlay);
    activateRecording(queue[i], queue, i, true);
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
    route();
  }
  if (el.dataset.filter) {
    filter = el.dataset.filter;
    limit = 40;
    route();
  }
  if (el.dataset.moreArtistRecords) {
    const id = el.dataset.moreArtistRecords;
    artistRecordLimits.set(id, (artistRecordLimits.get(id) || 40) + 40);
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
    const r = catalogById.get(el.dataset.recover);
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
    const r = catalogById.get(el.dataset.holders),
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
    const r = catalogById.get(el.dataset.owner),
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
    !document.querySelector("dialog[open]") &&
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
applyQueueState(queueState);
$("#shuffle").onclick = () => {
  applyQueueState(toggleQueueShuffle(queueState));
  try {
    localStorage.setItem("mn-archive-shuffle", String(queueState.enabled));
  } catch {}
  if ($("#queue-dialog").open) showQueue();
};
$("#mobile-queue").onclick = showQueue;
$("#show-queue").onclick = showQueue;
$("#queue-now").onclick = showQueue;
$("#player-title").onclick = () => nowPlaying.open();
$("#open-now-playing").onclick = () => nowPlaying.open();
$("#proof-now").onclick = () => {
  if (current) location.hash = recordLink(current) + "?tab=proof";
};
$("#player-like").onclick = () => current && toggleLike(current.id);
function playbackState() {
  return {
    currentId: current?.id,
    requested: wantsPlayback,
    pending: startingPlayback,
    paused: audio.paused,
    ended: !startingPlayback && audio.ended,
    error: !startingPlayback && !!audio.error,
    queueIndex,
  };
}
function syncPlaybackControls() {
  const state = playbackState();
  if (current && "mediaSession" in navigator) {
    try {
      if (
        mediaSessionRecordId !== current.id &&
        typeof MediaMetadata === "function"
      ) {
        const artwork = image(current);
        navigator.mediaSession.metadata = new MediaMetadata({
          title: cleanTitle(current.title),
          artist: current.artist,
          album: "Music Nerd",
          artwork: artwork ? [{ src: artwork }] : [],
        });
        mediaSessionRecordId = current.id;
      }
      navigator.mediaSession.playbackState =
        !audio.paused && !audio.ended ? "playing" : "paused";
    } catch {}
  }
  syncRecordingControls(document, state, {
    recordById: (id) => catalogById.get(id),
    icon: navIcon,
  });
  const { action } = recordingControlState({ ...state, id: current?.id });
  $("#toggle").innerHTML = navIcon(action);
  $("#toggle").setAttribute(
    "aria-label",
    action === "pause" ? "Pause" : "Play",
  );
  nowPlaying?.update();
}
async function activateRecording(
  id,
  list = null,
  index = null,
  queueOccurrence = false,
) {
  if (current?.id !== id || (queueOccurrence && index !== queueIndex)) {
    const playing = play(id, list, index);
    if (current?.id === id) nowPlaying.open();
    return playing;
  }
  const action = recordingControlState({ ...playbackState(), id }).action;
  const toggling = toggleCurrentPlayback();
  if (action === "play") nowPlaying.open();
  return toggling;
}
async function toggleCurrentPlayback() {
  if (!current) return;
  const { action } = recordingControlState({
    ...playbackState(),
    id: current.id,
  });
  if (action === "pause") {
    wantsPlayback = false;
    clearTimeout(mediaTimer);
    audio.pause();
    syncPlaybackControls();
    return;
  }
  wantsPlayback = true;
  if (startingPlayback) {
    syncPlaybackControls();
    return;
  }
  if (
    audio.error ||
    audio.ended ||
    !audio.getAttribute("src") ||
    $("#player-source").textContent.includes("unavailable")
  )
    return play(current.id, queue, queueIndex);
  try {
    await audio.play();
  } catch {
    wantsPlayback = false;
    notify("This recording could not be played. Press play to retry.");
  }
  syncPlaybackControls();
}
$("#toggle").onclick = toggleCurrentPlayback;
if ("mediaSession" in navigator) {
  const actions = {
    play: () => {
      if (audio.paused) void toggleCurrentPlayback();
    },
    pause: () => {
      if (!audio.paused || startingPlayback) {
        wantsPlayback = false;
        audio.pause();
        syncPlaybackControls();
      }
    },
    previoustrack: () => $("#previous").click(),
    nexttrack: () => $("#next").click(),
    seekto: ({ seekTime }) => {
      if (Number.isFinite(seekTime) && Number.isFinite(audio.duration))
        audio.currentTime = Math.min(audio.duration, Math.max(0, seekTime));
    },
  };
  for (const [action, handler] of Object.entries(actions)) {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch {}
  }
}

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
  $("#mute").innerHTML = navIcon(audio.muted ? "muted" : "volume");
  $("#mute").setAttribute(
    "aria-label",
    audio.muted ? "Unmute audio" : "Mute audio",
  );
};
function bindPlayerEvents() {
  mediaEvents?.abort();
  mediaEvents = new AbortController();
  const element = audio;
  const bind = (event, handler) =>
    element.addEventListener(
      event,
      () => {
        if (element === audio) handler();
      },
      { signal: mediaEvents.signal },
    );
  bind("playing", () => {
    clearTimeout(mediaTimer);
    warmNextTrack();
    syncPlaybackControls();
    if (current)
      $("#player-source").textContent =
        `${chainNames[current.chainId]} → ${sourceKind(current.recovery?.mediaURI)} · ${mediaLabel(current)}`;
  });
  bind("timeupdate", () => {
    if (audio.currentTime > 0) clearTimeout(mediaTimer);
    warmNextTrack();
    $("#elapsed").textContent = time(audio.currentTime);
    $("#duration").textContent = time(audio.duration);
    nowPlaying.update();
    $("#seek").value = Number.isFinite(audio.duration)
      ? (audio.currentTime / audio.duration) * 1000
      : 0;
  });
  bind("play", () => {
    wantsPlayback = true;
    syncPlaybackControls();
  });
  bind("pause", () => {
    nextTrackBuffer.suspend();
    if (!startingPlayback) wantsPlayback = false;
    syncPlaybackControls();
  });
  bind("ended", () => {
    wantsPlayback = false;
    syncPlaybackControls();
    if (queueIndex + 1 < queue.length)
      play(queue[queueIndex + 1], queue, queueIndex + 1);
  });
  bind("error", syncPlaybackControls);
  bind("loadstart", syncPlaybackControls);
  bind("progress", warmNextTrack);
  bind("waiting", () => {
    nextTrackBuffer.suspend();
    syncPlaybackControls();
  });
  bind("stalled", () => {
    if (!hasPlaybackHeadroom(audio)) nextTrackBuffer.suspend();
  });
}
nowPlaying = mountNowPlaying({
  dialog: $("#now-playing-dialog"),
  icon: navIcon,
  getState: () => ({
    record: current && { ...current, title: cleanTitle(current.title) },
    image: current ? image(current) : "",
    source: $("#player-source").textContent,
    action: recordingControlState({ ...playbackState(), id: current?.id })
      .action,
    shuffle: queueState.enabled,
    liked: likes.has(current?.id),
    elapsed: time(audio.currentTime),
    duration: time(audio.duration),
    seek: Number.isFinite(audio.duration)
      ? (audio.currentTime / audio.duration) * 1000
      : 0,
    muted: audio.muted,
    volume: audio.volume,
  }),
  onAction: (action, value) => {
    if (action === "toggle") void toggleCurrentPlayback();
    else if (action === "queue") showQueue();
    else if (action === "record") {
      nowPlaying.close();
      location.hash = recordLink(current);
    } else if (action === "like") {
      // Updating a like from the overlay must not replace the page underneath.
      likes.has(current.id) ? likes.delete(current.id) : likes.add(current.id);
      try {
        localStorage.setItem("mn-archive-likes", JSON.stringify([...likes]));
      } catch {}
      $("#liked-count").textContent = likes.size;
      $("#player-like").textContent = likes.has(current.id) ? "♥" : "♡";
      for (const button of main.querySelectorAll("[data-like]"))
        if (button.dataset.like === current.id) {
          button.classList.toggle("active", likes.has(current.id));
          button.textContent = likes.has(current.id) ? "♥" : "♡";
          button.setAttribute(
            "aria-label",
            `${likes.has(current.id) ? "Unlike" : "Like"} ${current.title}`,
          );
        }
    } else if (action === "seek") {
      if (Number.isFinite(audio.duration))
        audio.currentTime = (value / 1000) * audio.duration;
    } else if (action === "volume") {
      audio.volume = value;
      $("#volume").value = value;
    } else $("#" + action)?.click();
  },
});
bindPlayerEvents();
const playbackControlObserver = new MutationObserver((mutations) => {
  if (
    mutations.some((mutation) =>
      [...mutation.addedNodes].some(
        (node) =>
          node.nodeType === 1 &&
          (node.matches(recordingControlSelector) ||
            node.querySelector(recordingControlSelector)),
      ),
    )
  )
    syncPlaybackControls();
});
playbackControlObserver.observe(main, { childList: true, subtree: true });
playbackControlObserver.observe($("#queue-list"), {
  childList: true,
  subtree: true,
});
const mobile = document.createElement("div");
mobile.className = "mobile-nav";
mobile.setAttribute("aria-label", "Mobile navigation");
mobile.innerHTML = [
  ["home", navIcon("home"), "Home"],
  ["explore", navIcon("explore"), "Explore"],
  ["artists", navIcon("artists"), "Artists"],
  ["playlists", navIcon("playlists"), "Playlists"],
  ["me", navIcon("me"), "Profile"],
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
    if (fullRecordIds.has(id)) collectors.load(id);
    else loadRecordDetails(id);
    return;
  }
  route();
  window.scrollTo({ top: 0, behavior: "instant" });
});
try {
  await loadCatalog();
  route();
  fetch("/api/coverage")
    .then((r) => (r.ok ? r.json() : null))
    .then((value) => {
      coverage = value;
      if (location.hash === "#recovery") route();
    })
    .catch(() => {});
  fetch("/api/archive")
    .then((r) => r.json())
    .then((d) => {
      archive = d;
      if (
        location.hash.startsWith("#historic-playlists") ||
        location.hash === "#community" ||
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
