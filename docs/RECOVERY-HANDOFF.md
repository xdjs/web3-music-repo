# Music Nerd music NFT recovery — agent handoff

Checkpoint: November 6, 2026, updated during the production release. Originator: **Pete Rango**. This document replaces the earlier handoff-only checkpoint. Final release checks and later data-worker checkpoints can supersede the counts below.

## Repository and local workspaces

Dedicated public repository: https://github.com/xdjs/web3-music-repo . The implementation and public data are published in [draft PR #1](https://github.com/xdjs/web3-music-repo/pull/1), branch `codex/recovery-app`. Main remains the earlier handoff checkpoint until merged.

- Git checkout: `/Users/peterarango/Documents/Music Nerd/Apps/web3-music-repo`.
- Active preview and bulk workers: `/Users/peterarango/Documents/Music Nerd/Apps/music-nft-recovery`, http://127.0.0.1:4190.
- The preview directory remains a preserved local working copy without Git. Its `.env.local` and private playlist data were deliberately not transferred.
- The documentary at `/Users/peterarango/Documents/Music Nerd/Music NFT Era` is a different, dirty repository. Do not reset, stage or overwrite it.
- Public deployment: https://web3-music-repo.vercel.app . The next release is being assembled; verify its deployed source/build before treating local polish as live.
- The canonical Music Nerd database is used for read-only account lookup. Account playlists use a separate private Vercel Blob store. No canonical account creation or merge is performed.
- Lab submission under Pete Rango is prepared and explicitly authorized, but remains unpublished until final live QA. See `docs/lab-submission-plan.md`.

Before editing, inspect running processes and working directories. Do not run two writers against one data file. Recovery data continues to change in the preview copy; the Git checkout is a reviewed checkpoint, not an automatic mirror.

## Latest user requests and implemented behavior

Pete requested all-track metadata recovery, useful musical/credit details, artist revenue, Open BPM for missing tempo, and a user profile for wallet collections/playlists.

- `#me` is My profile, with My collection / My playlists tabs and the existing Music Nerd controls. Privy-linked wallets and browser connections remain distinct. Guest wallet lookup/local playlists work. The account-loading placeholder is cleared when the account card mounts.
- Metadata extraction now preserves CHAOS BPM/key/credits, plus genre, label, duration, location, license and other explicitly supplied release fields. The previous count of 27 BPM tracks came from a narrow description parser and was incomplete.
- Song Details displays metadata-supplied BPM/key separately from `~BPM` Open BPM estimates. Original credits and compact expandable metadata retain source links. Estimates never override supplied BPM; confidence below 0.3 is withheld for review.
- Catalog financial recovery validates the exact purchase event, gross USDC debit, and transfer to the historical artist payout address. Gross sales, artist payout, platform and referral amounts remain separate. Deduplication uses event IDs and BigInt amounts. Album purchases, secondary sales and later activity are not claimed.
- Catalog collectors: Ethereum historical owners; Base purchase recipients, explicitly not current balances (the transfer export omits mint history). Exact chain/contract/token matching is required.
- The Park Zora media and exact-token mint comments are integrated. Pete Rango’s `rush` is also recovered as a clearly labeled 20.63-second coin-backed video clip, with ERC-20 safeguards; it is not presented as a full-song NFT.
- Mint Songs Ethereum V2 and a bounded Polygon sample are integrated, with original metadata, creator credits and exact media references. Original BPM/key are absent in the inspected cohort, not proven absent platform-wide. See `docs/mint-songs-recovery.md`.
- Media and image recovery use bounded alternate gateways for the same CID/path; no replacement audio or invented profile image is substituted.
- Same-song tabs preserve the hero and scroll; collectors/PFPs remain visible in Details. About stays in sidebar/footer; the top slogan is gone.

## Current catalog and evidence

The listening-catalog checkpoint has **9,209 records**, after excluding artwork-only entries from listening surfaces. This is a temporary release checkpoint, not a complete-platform or distinct-recording count. Raw source bundles retain recovery evidence, so their totals can exceed the playable-media catalog. Further Zora imports and media classifications may change the next report.

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

Two resumable bulk workers have operated in the original preview directory. **Inspect live process state before resuming; a checkpoint timestamp does not prove a worker is running.**

1. `scripts/recover-music-metadata.mjs` writes `data/music-metadata.json`. It consumes official saved JSON, reuses a raw cache under `work/music-metadata-cache`, paces requests, retries rate limits, and preserves earlier successful data. The first all-record attempt hit extensive HTTP 429s; the latest pass completed for all 9,209 current listening records, using original JSON and attributed snapshots. This is metadata extraction coverage, not proof that all platform releases or media are recovered.
2. `scripts/analyze-missing-bpm.mjs` writes `data/audio-analysis.json`. It rechecks supplied BPM before each track, downloads/decodes full media, runs Open BPM, saves each result, and removes temporary audio. It currently runs four workers (`--concurrency=4`; default two), bounded file/duration limits, explicit low-confidence status, and cooldown/retry for HTTP 429. Thousands of entries remain pending; do not describe the run as complete.

Inspect `pgrep -fl 'node.*(run.cjs|work/live.mjs)'`, then confirm process cwd. The temporary wrappers were repointed during work; read them before running. Prefer the named npm scripts when resuming. Do not start a duplicate worker while one still owns the output.

Open BPM 0.1.0 was built from the pinned source because crates.io did not have the requested package. Rust/Cargo and binary are under `/Users/peterarango/Documents/Music Nerd/Apps/.music-recovery-tools/cargo/bin/`, with Rustup alongside. No shell startup file was changed. See README for portable installation.

After jobs finish: regenerate the report, inspect failures by reason, retry unreachable media deliberately, review the changed public JSON, copy those checkpoints into the Git checkout, rerun validation, and commit. Do not copy `.env*`, `private/`, `node_modules/`, temporary audio, or historical frontend bundles.

## Validation

- Unit coverage includes receipt/currency/payout checks, metadata precedence, collector token scope, account isolation, conditional playlist persistence, comment provenance, ERC-20 safeguards, and finite gateway fallback. The release orchestrator is rerunning the complete suite; do not reuse an older test count as final evidence.
- Syntax and formatting checks pass in the preview copy.
- Rendered music metadata/revenue and My profile verified at 1440px and 390px, light and dark, with no overflow or browser errors. Profile tabs do not shift, and the loading placeholder disappears.
- Browser verification passed playback, search, likes, Pete credits, live ownership/collectors, contract rereads, comments, mobile navigation, and local playlist create/add/reorder/rename/reload/play/next/remove/delete.
- A playlist playback check initially timed out on live media, then passed on retry. Keep external media failures visible; do not silently mark them verified.
- Collector browser check loaded 64 collectors, followed a forward-verified ENS profile, and confirmed playback still works.
- Evidence: `data/music-details-ui-verification.json`, `data/profile-catalog-ui-verification.json`, existing collector/comment reports and `captures/`.
- Local real Privy email/wallet modal verified at 1440/390px in both themes; no OTP or wallet signature sent. Mocked account fixtures cover linked wallets, add/connect distinctions, setup retry, save/load and logout isolation. These do not prove a real personal authenticated transaction.
- Four additional live playback samples passed: rush, Mint Songs Driving, Sound Breakdown, Catalog IOI. Polygon TAY artwork recovered through a same-CID fallback after a forced gateway failure. See `data/recovery-playback-verification.json` and `data/image-recovery-verification.json`.
- Playlist sharing passed local fresh-recipient browser checks: original MIAMI playback, ordered Next, independent saved copy/edit/reload, likes, invalid links and unavailable entries. Links contain a bounded compressed snapshot of title and catalog IDs only; account save/load remains separate. See `data/playlist-sharing-verification.json` and `docs/playlist-sharing.md`. Production deployment remains pending.
- Four historical Sound playlist snapshots are now integrated locally: Chill n Work (23/23 details), STØNED & STÅRVING #5 (16/22), MOMINTS VOL-IV (14/14), Lofi Chill (10/10). The prior seven Chill gaps were an extractor omission: its archived activity feed preserves those exact track IDs. Detail recovery, catalog matching and playback are separate counts. See `docs/historical-playlist-recovery.md`; four-list navigation/direct-link reload/save-copy browser verification passed at 1440/390px in both themes with no overflow or page errors (`data/historical-playlists-verification.json`). Catalog matches are 23, 15, 13, 10 respectively; saved copies retain those matched entries in exact order. Production deployment remains pending.
- Playback preloading is under integration/review; use the orchestrator’s final deployment evidence before describing it as deployed.

## Remaining blockers and next priorities

1. Complete the metadata/BPM workers and review unavailable/low-confidence results. Arweave is returning HTTP 429 for some content. Preserve original values and distinguish unknown, unavailable, and estimated.
2. Broaden revenue: Catalog Ethereum sales/royalties, album allocation, Sound mint payments/splits, then Zora. Never multiply current price by editions or call secondary sale volume artist income. Keep currencies and historical USD conversions separate.
3. Sound Base/Polygon historical scans remain incomplete. Empty responses caused by errors are not completed censuses. Additional Zora music discovery is multi-chain and cannot rely on a universal music tag.
4. Privy origin configuration is fixed: local client allows only localhost/127.0.0.1:4190; production client allows only https://web3-music-repo.vercel.app. Both live API read-backs passed, with main/default settings preserved. Production environment is configured; final deployment/modal QA is pending. Real personal sign-in, linked-wallet flow and account save/load still need user testing. Unknown canonical accounts receive 409 and must first onboard through Music Nerd.
5. Private Vercel Blob storage now provides durable production account playlists with conditional writes and account isolation. Guest playlists remain browser-local; real personal end-to-end persistence is unverified. Wallet library only matches known catalog tokens and supported indexers, not every wallet NFT on every chain.
6. Missing PFPs need attributable historical images or forward-verified ENS. Do not choose arbitrary NFTs as a person's avatar. More artist banners and faithful historical organization remain useful.
7. Reassess wallet dependency advisories before deployment (last audit: 29 transitive issues, 11 moderate/18 high). No forced breaking downgrade was applied.

## Design reference and file map

Reuse the established Sound/Music Nerd screen structure and shared controls. Actual references: `docs/sound-page-design-reference.md`, `evidence/reference-screens/artist-historical.png`, `evidence/reference-screens/song-historical.png`. Verify rendered changes in both themes and viewports.

Core: `archive.html`, `src/archive.js`, `src/archive.css`, `server.mjs`, `src/catalog-bundle.mjs`.
Accounts: `src/account-login.jsx`, `src/account-profile.jsx`, `src/account-wallets.jsx`, `src/personal-playlists.mjs`, `src/wallet-library-ui.mjs`.
Enrichment: `src/extract-music-metadata.mjs`, `src/music-facts.mjs`, metadata/BPM/report scripts.
Catalog: `src/catalog-holders.mjs`, `src/catalog-revenue.mjs`, `scripts/recover-catalog-revenue.mjs`, `data/catalog/`, `evidence/catalog-payments/`.
Comments: `src/zora-comments.mjs`, `scripts/recover-zora-onchain-comments.mjs`, `evidence/zora-comments/`.

The repository contains implementation and public recovery data. Private environment files, account playlist objects, temporary audio, and credentials stay outside Git. Vercel serves the public app; check live deployment evidence separately from repository state.

## November 6 artist identity follow-up

Pete confirmed `p3t3rango`. Both names resolve to one profile. The ten explicitly attributed NFT records plus the labeled rush clip are surfaced; five missing collaborator relationships were sourced and linked. See `docs/platform-and-pete-coverage.md` and `docs/pete-cross-platform-recovery.md` for evidence, public linked-wallet leads, and remaining platform gaps. This is not a complete discography.


## Latest listening release

- Clean shared SVG navigation/player controls; Artists directory naming; visible Collection/Network/Media/Sort row with oldest/newest sorting. 8,675 current records have supported historical token or release-contract dates, and unknown dates sort last. Recovery timestamps are never used as release dates.
- 60 artwork-only records excluded after inspecting original metadata; source discovery evidence remains preserved for later music attachment recovery.
- Automatic browsing queues preserve explicit queues; individual removal and Clear queue keep the current audio playing. Four viewport/theme checks used real audio through end-of-track.
- One idle audio candidate can warm native player metadata; two starts per minute, two-second incomplete-request cutoff, no video/slow/data-saving/offline/background warming. Browser buffering controls bytes; there is no hard byte-budget claim.
- Shared playlist links contain a bounded compressed title/track-ID snapshot. A recipient can play without login and save an independent editable copy. Four historical Sound playlists have play/save/share/like controls.
- Six additional verified Pete-related recordings: Dreamvibe, Planet X, Tragg Park, Oms at Play, Evermore DEMO Tape REIN X Pete Rango, and Mavi Taylor's Say it celly. Alongside the earlier ten NFTs and rush clip, Pete now has 17 attributed records. See `docs/pete-zora-expanded.md`; this is not a complete discography. Evermore remains platform Other pending exact platform provenance.
- OpenSea holdings: 412 unique enumerated items versus a displayed413 total; creator attribution is independently established. New Base Sound-looking contracts remain discovery leads until factory provenance is verified.
- Instagram/audio clip exports were discussed as the next sharing feature; they are not implemented. Supercollector catalog investigation is a separate next import.

Release verification before deploy: 148 JavaScript tests and five Catalog-export Python tests pass; syntax, formatting, private-Blob live CAS probe, selected actual-media playback, playlist sharing, four historical playlists, navigation/filter and queue checks pass. Real personal email OTP, wallet signing, linked-wallet persistence and real-account playlist save/load remain user checks.

Metadata checkpoint 2026-11-06T09:48:58.382Z: 9209 current records read; 1571 supplied BPM values; 1339 supplied keys. Open BPM remains running locally and its output is not automatically deployed.
