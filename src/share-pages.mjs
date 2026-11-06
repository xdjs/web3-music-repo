import {
  decodePlaylistShare,
  PLAYLIST_SHARE_LIMITS,
} from "./playlist-share.mjs";
import { storageURL } from "./nft-reader.mjs";
const DEFAULT_ORIGIN = "https://web3-music-repo.vercel.app";
const FALLBACK_IMAGE = "/social/music-nft-recovery-v1.png";
const esc = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
const text = (value, max = 180) =>
  String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
const cleanTitle = (value) => text(value).replace(/\s*#\d+$/, "");
export function sharePageOrigin(configured, requestHost) {
  if (/^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(requestHost || "")) {
    try {
      return new URL("http://" + requestHost).origin;
    } catch {}
  }
  try {
    const u = new URL(configured);
    if (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      u.pathname === "/" &&
      !u.search &&
      !u.hash
    )
      return u.origin;
  } catch {}
  return DEFAULT_ORIGIN;
}
function imageURL(value, origin) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    if (value.startsWith("/") && !value.startsWith("//")) {
      const u = new URL(value, origin);
      if (
        u.origin === origin &&
        /^\/(people|media|recovered|social)\//.test(u.pathname) &&
        !u.search &&
        !u.hash
      )
        return u.href;
      return null;
    }
    const u = new URL(
      value.startsWith("ipfs:") || value.startsWith("ar:")
        ? storageURL(value)
        : value,
    );
    return u.protocol === "https:" && !u.username && !u.password && !u.port
      ? u.href
      : null;
  } catch {
    return null;
  }
}
function recordImage(record, bundle, origin) {
  const e = bundle.evidence?.[record?.id];
  for (const value of [
    e?.localImage,
    e?.imageURL,
    record?.imageURL,
    record?.imageURI,
  ]) {
    const url = imageURL(value, origin);
    if (url) return url;
  }
  return null;
}
const indexes = new WeakMap();
function index(bundle) {
  let result = indexes.get(bundle);
  if (result) return result;
  result = {
    records: new Map(bundle.records.map((r) => [r.id, r])),
    people: new Map(bundle.people.map((p) => [p.id, p])),
    artistRecords: new Map(),
  };
  for (const r of bundle.records) {
    const ids = new Set([
      r.artistId,
      ...(r.personIds || []),
      ...(r.credits || []).map((c) => c.personId),
    ]);
    for (const id of ids) {
      if (!id) continue;
      const rows = result.artistRecords.get(id) || [];
      rows.push(r);
      result.artistRecords.set(id, rows);
    }
  }
  indexes.set(bundle, result);
  return result;
}
function htmlPage(entity, origin, { mix = false } = {}) {
  const canonical = origin + entity.path,
    image = entity.image || origin + FALLBACK_IMAGE,
    title = text(entity.title, 240),
    description = text(entity.description, 320),
    destination = entity.destination;
  const script = JSON.stringify(destination)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} — Music Nerd</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(canonical)}">${mix ? '<meta name="robots" content="noindex, nofollow">' : ""}<meta property="og:type" content="${esc(entity.type)}"><meta property="og:site_name" content="Music Nerd"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${esc(image)}"><meta property="og:image:alt" content="${esc(entity.imageAlt || title)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${esc(image)}"><meta name="twitter:image:alt" content="${esc(entity.imageAlt || title)}"><link rel="stylesheet" href="/src/archive.css"></head><body><main><section class="record-head"><div class="cover"><img src="${esc(image)}" alt="${esc(entity.imageAlt || title)}"></div><div><span class="eyebrow">MUSIC NFT RECOVERY · MUSIC NERD</span><h1>${esc(title)}</h1><p>${esc(description)}</p><div class="actions"><a class="primary" href="${esc(destination)}">Open in Music Nerd ↗</a></div></div></section><noscript><p>This share opens in the app using the link above.</p></noscript></main><script>location.replace(${script});</script></body></html>`;
}
function notFound() {
  return {
    status: 404,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Share not found — Music Nerd</title><link rel="stylesheet" href="/src/archive.css"></head><body><main><div class="empty"><h1>This share could not be found.</h1><p>The link may be incomplete or refer to an item that is not in this catalog.</p><a class="primary" href="/">Explore Music Nerd</a></div></main></body></html>',
  };
}
export async function buildSharePage({
  pathname,
  origin = DEFAULT_ORIGIN,
  bundle,
  playlists = [],
  artistImage = () => null,
}) {
  if (
    typeof pathname !== "string" ||
    pathname.length > PLAYLIST_SHARE_LIMITS.encodedChars + 100
  )
    return notFound();
  const match = /^\/share\/(record|artist|playlist|mix)\/([^/]+)$/.exec(
    pathname,
  );
  if (!match) return notFound();
  const kind = match[1];
  let id;
  try {
    id = decodeURIComponent(match[2]);
  } catch {
    return notFound();
  }
  if (
    !id ||
    /[\u0000-\u001f\u007f/\\]/.test(id) ||
    (kind !== "mix" && id.length > 200)
  )
    return notFound();
  const data = index(bundle),
    path = "/share/" + kind + "/" + encodeURIComponent(id);
  let entity;
  if (kind === "record") {
    const r = data.records.get(id);
    if (!r) return notFound();
    const title = cleanTitle(r.title),
      artist = text(r.artist, 120);
    entity = {
      path,
      title: `${title} — ${artist}`,
      description: `Listen to ${title} by ${artist}${r.platform ? " · " + text(r.platform, 60) : ""}. Explore the recording and its preserved sources on Music Nerd.`,
      type: "music.song",
      image: recordImage(r, bundle, origin),
      imageAlt: `${title} artwork`,
      destination: "/#record/" + encodeURIComponent(id),
    };
  } else if (kind === "artist") {
    const p = data.people.get(id);
    if (!p) return notFound();
    const records = data.artistRecords.get(id) || [],
      name = text(p.name);
    const portrait = artistImage(p, records) || p.portrait;
    entity = {
      path,
      title: name,
      description: `Explore ${records.length.toLocaleString("en-US")} recovered ${records.length === 1 ? "recording" : "recordings"} associated with ${name} on Music Nerd. Listen and follow the preserved music NFT sources.`,
      type: "website",
      image: imageURL(
        typeof portrait === "string" ? portrait : portrait?.src,
        origin,
      ),
      imageAlt: `${name} artist image`,
      destination: "/#artist/" + encodeURIComponent(id),
    };
  } else if (kind === "playlist") {
    const p = playlists.find((p) => p.id === id);
    if (!p) return notFound();
    const known = (p.tracks || []).filter((t) => !t.missing),
      first = known.find((t) => imageURL(t.coverURL, origin));
    entity = {
      path,
      title: text(p.name),
      description: `A recovered playlist${p.curator ? " by " + text(p.curator, 100) : ""}. ${known.length} track details preserved${Number.isSafeInteger(p.declaredCount) ? " from " + p.declaredCount + " original entries" : ""}. Explore its original order and recovered recordings on Music Nerd.`,
      type: "music.playlist",
      image: first ? imageURL(first.coverURL, origin) : null,
      imageAlt: `Artwork from ${text(p.name)}`,
      destination: "/#historic-playlists/" + encodeURIComponent(id),
    };
  } else {
    let p;
    try {
      p = await decodePlaylistShare(id);
    } catch {
      return notFound();
    }
    const found = p.recordIds.map((id) => data.records.get(id)).filter(Boolean);
    const first = found.find((r) => recordImage(r, bundle, origin));
    entity = {
      path,
      title: p.name,
      description: `A shared music playlist with ${p.recordIds.length} ${p.recordIds.length === 1 ? "entry" : "entries"}${found.length !== p.recordIds.length ? "; " + found.length + " currently matched in this catalog" : ""}. Listen on Music Nerd and save your own copy.`,
      type: "music.playlist",
      image: first ? recordImage(first, bundle, origin) : null,
      imageAlt: `Artwork from ${text(p.name)}`,
      destination: "/#shared-playlist/" + id,
    };
  }
  return {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control":
        kind === "mix" ? "no-store" : "public, max-age=300, s-maxage=3600",
      "Referrer-Policy": "no-referrer",
    },
    body: htmlPage(entity, origin, { mix: kind === "mix" }),
    entity,
  };
}
