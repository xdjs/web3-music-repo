import { isSolanaMint } from "./solana-identity.mjs";
import { sourceKind } from "./recovery-model.mjs";
const publicURL = (value) => {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
};
export function renderSolanaProvenance(record, esc) {
  const v = record.recovery || {};
  const link = (url, label) => {
    const safe = publicURL(url);
    return safe
      ? `<a href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`
      : "";
  };
  const mint = isSolanaMint(record.mint) ? record.mint : null;
  const preserved = v.mediaSourceType === "spinamp-preserved-audio";
  const startupTimeout =
    v.originalMediaUnavailableReason === "original-startup-timeout";
  return `<div class="reading"><h2>Follow the surviving record</h2><p class="notice">This Nina recording’s Solana mint, metadata and media references were preserved in Spinamp’s public index. They have not been independently verified against the current Solana chain. ${link(v.source, "Published index source")}</p><p>The mint identifies the token. Nina’s release account is a separate address; neither is an Ethereum contract or a numeric token ID.</p></div><div class="provenance"><div class="proof-step"><span class="step-num">1</span><div><h3>Solana · Indexed mint</h3><code>${esc(mint || "Mint identity unavailable")}</code><p>Metaplex token · case-sensitive mint address</p></div>${mint ? link("https://explorer.solana.com/address/" + mint, "Inspect mint") : ""}</div><div class="proof-step"><span class="step-num">2</span><div><h3>${sourceKind(v.metadataURI || v.metadataURL)} · Metadata</h3><code>${esc(v.metadataURI || v.metadataURL || "Reference unavailable")}</code><p>This metadata reference comes from the preserved index, not a live mint-account read.</p></div>${link(v.metadataURL, "Open indexed metadata")}</div><div class="proof-step"><span class="step-num">3</span><div><h3>${sourceKind(v.mediaURI || v.mediaURL)} · ${preserved ? "Spinamp preserved audio" : "Indexed media"}</h3><code>${esc(v.mediaURI || v.mediaURL || "Reference unavailable")}</code><p>${preserved ? (startupTimeout ? "The original audio did not start during a bounded playback check. Playback uses a separate audio copy preserved by Spinamp, which may be transcoded; the original reference remains below." : "Audio preserved separately by Spinamp may be transcoded.") : "The index associates this media reference with the mint."} Playback availability is checked separately when you listen.</p>${preserved && v.originalMediaURI ? `<p>Original indexed media reference:</p><code>${esc(v.originalMediaURI)}</code>${link(v.originalMediaURI, "Open original indexed media")}` : ""}</div>${link(v.mediaURL, preserved ? "Open Spinamp audio" : "Open indexed media")}</div></div><div class="reading"><h3>Nina release</h3><p>The public release address is preserved separately from the token mint. ${link(record.originalRelease, "Open Nina release")}</p></div><div class="notice" id="verify-status">Current Solana metadata verification, collector recovery and wallet-owned Nina collections are not implemented yet. Listening and playlists use the preserved media references.</div>`;
}
