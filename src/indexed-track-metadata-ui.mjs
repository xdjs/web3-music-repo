export function renderIndexedTrackMetadata(record, esc) {
  const data = record.indexedTrackMetadata;
  if (
    data?.source !== "https://api.spinamp.xyz/v3/graphql" ||
    data.sourceType !== "spinamp-track-index"
  )
    return "";
  const support = data.supportingArtist;
  const credit = support
    ? `<p>Supporting artist: ${support.personId ? `<a href="#artist/${encodeURIComponent(support.personId)}">${esc(support.name)}</a>` : esc(support.name)}<small class="link-note">Relationship preserved by Spinamp; a specific production or writing role is not established.</small></p>`
    : "";
  return `<details class="artist-sources" data-indexed-track-notes><summary>Notes preserved by Spinamp</summary>${data.description ? `<p class="original-release-notes">${esc(data.description)}</p>` : ""}${credit}<p class="link-note">A separately preserved index entry; it may differ from the original release metadata.</p><a class="link-note" href="${esc(data.source)}" target="_blank" rel="noopener noreferrer">Spinamp metadata source ↗</a></details>`;
}
