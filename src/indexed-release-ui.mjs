// Same provenance layout as token-linked releases, with no invented token step.
export function renderIndexedReleaseProvenance(record, esc) {
  const v = record.recovery || {};
  const link = (url, label) =>
    /^https:\/\//.test(url || "")
      ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`
      : "";
  return `<div class="reading"><h2>Preserved by Spinamp</h2><p class="notice">NFT identity not established. This recording was retained in Spinamp’s music index, but an exact token or mint has not been linked. This is not evidence that it was never minted.</p><p>Playback uses Spinamp’s preserved audio copy. It may be transcoded; it is not verified original NFT media. Artist and release details are attributed to the index. Collectors, ownership, and onchain revenue remain unavailable until a token mapping is recovered.</p></div><div class="provenance"><div class="proof-step"><span class="step-num">1</span><div><h3>Spinamp music index</h3><code>${esc(record.spinampTrackId || "Unknown track reference")}</code><p>${record.indexedNetwork ? `Network label in the index: ${esc(record.indexedNetwork)}. This is not a verified mint location.` : "No verified blockchain identity."}</p></div>${link(v.source, "Index source")}</div><div class="proof-step"><span class="step-num">2</span><div><h3>Spinamp preserved audio</h3><code>${esc(v.mediaURI || "Unresolved")}</code><p>The stored audio reference is preserved independently of NFT ownership. Playback availability is checked separately.</p></div>${link(v.mediaURL, "Open Spinamp audio")}</div></div>${link(record.originalRelease, "Indexed release page")}`;
}
