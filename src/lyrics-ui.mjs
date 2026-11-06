import { LYRICS_BYTE_LIMIT } from "./extract-music-metadata.mjs";
function safeSource(record) {
  const data = record?.musicMetadata;
  const value = [
    "official-public-release-page",
    "spinamp-indexed-metadata",
  ].includes(data?.sourceType)
    ? data.source
    : data?.metadataURL || record?.recovery?.metadataURL;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function renderLyrics(record, esc) {
  const data = record?.musicMetadata;
  let remaining = LYRICS_BYTE_LIMIT;
  const seen = new Set();
  const versions = (
    Array.isArray(data?.lyrics) ? data.lyrics.slice(0, 3) : []
  ).flatMap((value) => {
    if (
      typeof value?.text !== "string" ||
      value.text.length > LYRICS_BYTE_LIMIT ||
      !value.text.trim() ||
      seen.has(value.text)
    )
      return [];
    const size = new TextEncoder().encode(value.text).byteLength;
    if (size > remaining) return [];
    remaining -= size;
    seen.add(value.text);
    return [value.text];
  });
  if (!versions.length) return "";
  const source = safeSource(record);
  const sourceLabel =
    data.sourceType === "spinamp-indexed-metadata"
      ? "Lyrics indexed by Spinamp"
      : data.sourceType === "official-public-release-page"
        ? "Original release page"
        : "Original lyrics source";
  const sections = versions.map((text, index) => {
    const lines = text.split("\n");
    let preview = lines.slice(0, 4).join("\n");
    if (preview.length > 280) preview = preview.slice(0, 280).trimEnd();
    const long = preview !== text;
    const label =
      versions.length > 1 ? `Lyrics · version ${index + 1}` : "Lyrics";
    return `<section class="reading" data-lyrics><h2>${esc(label)}</h2>${long ? `<details class="artist-sources lyrics-panel"><summary><span class="lyrics-expand-label">Read full lyrics</span><span class="lyrics-collapse-label">Show fewer lyrics</span></summary><p class="original-lyrics">${esc(text)}</p></details><p class="original-lyrics lyrics-preview">${esc(preview)}<span aria-hidden="true">…</span></p>` : `<p class="original-lyrics">${esc(text)}</p>`}${source ? `<a class="link-note" href="${esc(source)}" target="_blank" rel="noopener noreferrer">${esc(sourceLabel)} ↗</a>` : ""}</section>`;
  });
  return sections.join("");
}
