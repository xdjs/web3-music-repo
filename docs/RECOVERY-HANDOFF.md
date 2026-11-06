# Music Nerd music NFT recovery — agent handoff

Checkpoint: November 5 evening / November 6, 2026 UTC. This document replaces the earlier handoff-only checkpoint.

## Repository and local workspaces

Dedicated public repository: https://github.com/xdjs/web3-music-repo . The implementation and public data are published in [draft PR #1](https://github.com/xdjs/web3-music-repo/pull/1), branch `codex/recovery-app`. Main remains the earlier handoff checkpoint until merged.

- Git checkout: `/Users/peterarango/Documents/Music Nerd/Apps/web3-music-repo`.
- Active preview and bulk workers: `/Users/peterarango/Documents/Music Nerd/Apps/music-nft-recovery`, http://127.0.0.1:4190.
- The preview directory remains a preserved local working copy without Git. Its `.env.local` and private playlist data were deliberately not transferred.
- The documentary at `/Users/peterarango/Documents/Music Nerd/Music NFT Era` is a different, dirty repository. Do not reset, stage or overwrite it.
- No production deployment, production database writes, or outbound messages were performed.

Before editing, inspect running processes and working directories. Do not run two writers against one data file. Recovery data continues to change in the preview copy; the Git checkout is a reviewed checkpoint, not an automatic mirror.

## Latest user requests and implemented behavior

Pete requested all-track metadata recovery, useful musical/credit details, artist revenue, Open BPM for missing tempo, and a user profile for wallet collections/playlists.

- `#me` is My profile, with My collection / My playlists tabs and the existing Music Nerd controls. Privy-linked wallets and browser connections remain distinct. Guest wallet lookup/local playlists work. The account-loading placeholder is cleared when the account card mounts.
- Metadata extraction now preserves CHAOS BPM/key/credits, plus genre, label, duration, location, license and other explicitly supplied release fields. The previous count of 27 BPM tracks came from a narrow description parser and was incomplete.
- Song Details displays metadata-supplied BPM/key separately from `~BPM` Open BPM estimates. Original credits and compact expandable metadata retain source links. Estimates never override supplied BPM; confidence below 0.3 is withheld for review.
- Catalog financial recovery validates the exact purchase event, gross USDC debit, and transfer to the historical artist payout address. Gross sales, artist payout, platform and referral amounts remain separate. Deduplication uses event IDs and BigInt amounts. Album purchases, secondary sales and later activity are not claimed.
- Catalog collectors: Ethereum historical owners; Base purchase recipients, explicitly not current balances (the transfer export omits mint history). Exact chain/contract/token matching is required.
- Three additional The Park Zora media references were integrated, including Onchain Summer; exact-token mint comments surface on their song pages.
- Same-song tabs preserve the hero and scroll; collectors/PFPs remain visible in Details. About stays in sidebar/footer; the top slogan is gone.

## Current catalog and evidence

9,099 app records: 4,974 Sound, 4,036 Catalog, 43 Songcamp, 28 Zora, 2 Arpeggi, 6 Other, 10 unconfirmed. These are deduplicated references, not a claim that all collections or distinct recordings have been recovered.

Read `data/enrichment-report.json` for the timestamped metadata/BPM/payment counts. They change during recovery; rerun `node scripts/report-enrichment.mjs` before quoting them.

- Sound known Ethereum/Optimism factory census: 9,488 contracts. Earlier cohort: 4,699 modern metadata successes, 276 legacy, 3,361 unminted, 1,256 unresolved. Consult source timestamps before combining cohorts.
- Sound archive: 2,878 historical comments across 83 releases; 2,162 recovered wallet-linked profiles; 1,053 locally preserved PFPs. Not complete or current identity coverage.
- Zora: 61 verified MintComment events from The Park on chain 7777777. Official minter, matching mint transfer, receipt and block provenance are retained. Wallet shown is mint recipient, not necessarily author. Base comment scans remain provider-limited.
- Catalog official snapshot: 4,164 token entries, 2,499 Ethereum + 1,665 Base; 4,106 supported media references; earlier 2,970 current metadata reads. App deduplication reduces Catalog record count.
- All 186 Base token-purchase rows in the official export now pass receipt/USDC verification, across 115 token identities; 113 match current app records. This is not all Catalog revenue. Historical purchase recipients and financial rows are separate views.
- 1,611 original Catalog metadata JSON objects were recovered directly from the official export and saved in `data/catalog/original-metadata.json`.
- Original metadata/notes currently provide hundreds of BPM values; the full retry scan and audio estimation pass are still running. Failed/rate-limited reads are unresolved, not proof that fields do not exist.

Sources: [Catalog data](https://github.com/catalogworks/catalog-squidward-data), [Catalog contracts pinned](https://github.com/catalogworks/catalog-release-contracts-public/tree/6bcc4fbdc7c3c0ea38f8758cdbd1c7f41a60f472), [Open BPM pinned](https://github.com/fabriziosalmi/open-bpm/tree/73a3e6ef33f5c9d4131d118b14dcd4da73ec1775).

## Active long-running work and resume

Two bulk workers are intentionally running in the original preview directory:

1. `scripts/recover-music-metadata.mjs` writes `data/music-metadata.json`. It consumes official saved JSON, reuses a raw cache under `work/music-metadata-cache`, paces requests, retries rate limits, and preserves earlier successful data. The first all-record attempt hit extensive HTTP 429s; the slower retry/enrichment pass remains underway.
2. `scripts/analyze-missing-bpm.mjs` writes `data/audio-analysis.json`. It rechecks supplied BPM before each track, downloads/decodes full media, runs Open BPM, saves each result, and removes temporary audio. It has two workers, bounded file/duration limits, explicit low-confidence status, and cooldown/retry for HTTP 429. Thousands of entries remain pending; do not describe the run as complete.

Inspect `pgrep -fl 'node.*(run.cjs|work/live.mjs)'`, then confirm process cwd. The temporary wrappers were repointed during work; read them before running. Prefer the named npm scripts when resuming. Do not start a duplicate worker while one still owns the output.

Open BPM 0.1.0 was built from the pinned source because crates.io did not have the requested package. Rust/Cargo and binary are under `/Users/peterarango/Documents/Music Nerd/Apps/.music-recovery-tools/cargo/bin/`, with Rustup alongside. No shell startup file was changed. See README for portable installation.

After jobs finish: regenerate the report, inspect failures by reason, retry unreachable media deliberately, review the changed public JSON, copy those checkpoints into the Git checkout, rerun validation, and commit. Do not copy `.env*`, `private/`, `node_modules/`, temporary audio, or historical frontend bundles.

## Validation

- 62 unit tests pass, including adversarial receipt/currency/payout checks, metadata precedence, collector token scope, account isolation, playlist persistence, and comment provenance.
- Syntax and formatting checks pass in the preview copy.
- Rendered music metadata/revenue and My profile verified at 1440px and 390px, light and dark, with no overflow or browser errors. Profile tabs do not shift, and the loading placeholder disappears.
- Browser verification passed playback, search, likes, Pete credits, live ownership/collectors, contract rereads, comments, mobile navigation, and local playlist create/add/reorder/rename/reload/play/next/remove/delete.
- A playlist playback check initially timed out on live media, then passed on retry. Keep external media failures visible; do not silently mark them verified.
- Collector browser check loaded 64 collectors, followed a forward-verified ENS profile, and confirmed playback still works.
- Evidence: `data/music-details-ui-verification.json`, `data/profile-catalog-ui-verification.json`, existing collector/comment reports and `captures/`.
- Real signed-in email/wallet flow is still unverified. Guest UI and mocked/unit access controls are not proof of real account completion.

## Remaining blockers and next priorities

1. Complete the metadata/BPM workers and review unavailable/low-confidence results. Arweave is returning HTTP 429 for some content. Preserve original values and distinguish unknown, unavailable, and estimated.
2. Broaden revenue: Catalog Ethereum sales/royalties, album allocation, Sound mint payments/splits, then Zora. Never multiply current price by editions or call secondary sale volume artist income. Keep currencies and historical USD conversions separate.
3. Sound Base/Polygon historical scans remain incomplete. Empty responses caused by errors are not completed censuses. Additional Zora music discovery is multi-chain and cannot rely on a universal music tag.
4. Privy returned `403 invalid_origin` for `http://127.0.0.1:4190`. Pete has not confirmed the allowed-origin fix. Real sign-in, linked-wallet flow, and account playlist save/load need user testing. Unknown canonical accounts receive 409 and must first onboard through Music Nerd.
5. Account playlists are local-server files; durable cloud storage and account onboarding remain unfinished. Wallet library only matches known catalog tokens and supported indexers, not every wallet NFT on every chain.
6. Missing PFPs need attributable historical images or forward-verified ENS. Do not choose arbitrary NFTs as a person's avatar. More artist banners and faithful historical organization remain useful.
7. Reassess wallet dependency advisories before deployment (last audit: 29 transitive issues, 11 moderate/18 high). No forced breaking downgrade was applied.

## Design reference and file map

Reuse the established Sound/Music Nerd screen structure and shared controls. Actual references: `docs/sound-page-design-reference.md`, `evidence/reference-screens/artist-historical.png`, `evidence/reference-screens/song-historical.png`. Verify rendered changes in both themes and viewports.

Core: `archive.html`, `src/archive.js`, `src/archive.css`, `server.mjs`, `src/catalog-bundle.mjs`.
Accounts: `src/account-login.jsx`, `src/account-profile.jsx`, `src/account-wallets.jsx`, `src/personal-playlists.mjs`, `src/wallet-library-ui.mjs`.
Enrichment: `src/extract-music-metadata.mjs`, `src/music-facts.mjs`, metadata/BPM/report scripts.
Catalog: `src/catalog-holders.mjs`, `src/catalog-revenue.mjs`, `scripts/recover-catalog-revenue.mjs`, `data/catalog/`, `evidence/catalog-payments/`.
Comments: `src/zora-comments.mjs`, `scripts/recover-zora-onchain-comments.mjs`, `evidence/zora-comments/`.

The new repository contains implementation and public data, not credentials or a production deployment. Keep that boundary explicit in the next handoff.
