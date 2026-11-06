# Music Nerd music NFT recovery — agent handoff

Updated November 6, 2026. Created and originated by **Pete Rango**. This is the separate recovery/listening app, not the Music NFT Era documentary.

## Current publication

- Repository: https://github.com/xdjs/web3-music-repo — PR #1 merged to `main`, app commit `e3458a1e29ff581dded2a90c0c6b19e454fa5548`.
- Live app: https://web3-music-repo.vercel.app/ . Production deployment `dpl_EzRjTGwjs26ny3bDyrUvDJnF1uEr`, built from a clean worktree at that exact merged commit.
- Immutable deployment: https://web3-music-repo-ql7ogjao5-musicnerd.vercel.app .
- Existing Lab listing: https://lab.musicnerd.net/peterango/music-nft-recovery . The Lab entry launches the Vercel app; it is not a separate application build. Its new cover, main source link, cookbook and Pete Rango credit were published and verified by API read-back and desktop/mobile rendering. See `docs/lab-submission-plan.md` and `data/lab-update-persistence.json`.
- Verification-only files committed after the app deployment do not change the deployed application code. `data/release-2026-11-06.json` and `data/production-final-verification.json` identify the tested release. Older failed/network-interrupted reports remain historical evidence, not the latest release result.

## Workspaces and active work

- Canonical checkout: `/Users/peterarango/Documents/Music Nerd/Apps/web3-music-repo`, now on `main`.
- Clean deployed worktree: `../web3-music-release-main`, detached at the deployed app commit. Do not modify it while tracing this release.
- Active preview and Open BPM worker: `../music-nft-recovery`, http://127.0.0.1:4190. The latest app files were synchronized there, preserving `.env.local`, private playlists, raw metadata cache and its newer audio-analysis output. It has no Git repository.
- The documentary `/Users/peterarango/Documents/Music Nerd/Music NFT Era` is a different dirty repository. Do not reset, stage, move or overwrite it.
- Never start two writers against one recovery output. Check lock owner PID/cwd before removing a stale lock. Checkpoints do not prove that a process is alive.

The Open BPM worker was verified as PID 85147 in the preview copy. Its committed snapshot at 10:24:58 UTC has 732 estimates, 21 low-confidence results, 264 unavailable, 7,574 pending and 612 supplied-BPM skips. The 4,437 newer records were not queued in that run. It analyzes accessible full audio up to 256 MB/30 minutes, confidence<0.3 withheld; tempo range 60–200 can produce half/double-time estimates. Original BPM always wins. The tested pinned Open BPM/Rust setup is documented in README; local binary is under `../.music-recovery-tools/cargo/bin/`. Do not overwrite this worker's newer checkpoint with the Git snapshot.

The Spinamp relation resolver continues only `data/spinamp/nft-references.json.gz`, deliberately gitignored. The frozen runtime bundle does not change automatically. At the release audit 26,409/52,987 relations were checked with 697 retryable failures. See the importer/resolver commands and limits in `docs/spinamp-recovery-plan.md`. Only regenerate a release candidate deliberately, after reviewing identity exclusions, source labels and actual media samples.

## Frozen catalog and source boundaries

**13,640 records**, not necessarily distinct compositions: Sound 8,729; Catalog 4,036; Supercollector 616; Mint Songs 162; Songcamp 43; Zora 34; Lens 1; other/unconfirmed/Arpeggi 19. No complete-platform, complete-discography or all-track playback claim is made. Exact token and record identity audit found no duplicates.

- Original documents/publisher snapshots cover 9,209 existing records. Catalog's official export supplies 4,036 app records; all available original Catalog and Mint Songs snapshots were inspected for explicit musical fields. Missing fields are not evidence the music lacks them.
- Supercollector adds 616 eligible public tracks from 152 checked ERC1155 contracts. Unreleased entries and 7 missing per-track references are excluded. ContractURI/index mismatches stay visible and are not promoted to independently verified media. See `docs/supercollector-recovery.md`.
- Spinamp adds 3,815 exact NFT-linked records from a 52,987-track discovery inventory: 3,814 Sound + 1 Lens, including 3,421 Base additions. 2,011 use explicitly labeled Spinamp-preserved audio because original metadata media is empty. Independent chain verification remains pending; 125 entries lack a retained metadataURI. Public index assertions never become onchain verification. See `docs/spinamp-recovery-plan.md`.
- Spinamp provides 1,211 source-attributed portrait references; one known Pete wallet maps to his existing profile. Name matching alone is not used to merge vendor identities. Remote portraits are not all visually checked.
- **1,275 songs have inline lyrics**, recovered from existing original metadata caches. Text preserves line breaks, is escaped, and expands on the song page; source links are secondary. Schema 5 and `apply-cached-lyrics.mjs` update only lyric fields, preserving existing metadata. See `docs/lyrics-recovery.md`.
- **2,477 supplied BPM values and 2,144 supplied keys**, across original documents, publisher snapshots, official release pages and explicitly indexed metadata. Open BPM estimates remain separate. `data/enrichment-report.json` distinguishes these source classes.
- Pete has 21 attributed records: core 17 (including six newly verified Zora/other collaborations and a clearly labeled 20.63 s rush coin-backed clip), three Supercollector collaborator credits, and an exact-wallet Lens release. Evermore remains Other pending platform proof; holdings are not authorship. This is not a complete discography.
- Sound census currently contains 9,488 known contracts, not songs. Multi-chain coverage remains incomplete. Spinamp's 28 factory seeds provide concrete scan boundaries, including Sound Base block 7,272,929; verify exact deployment events independently. No Polygon Sound factory appeared in that index response.

## User-facing behavior

Artist/credit search, clear platform/collection/network/media filters, sourced oldest/newest ordering, song Details/Collectors/Comments/Provenance, clean shared navigation/player icons, finite same-CID artwork/media fallback, and theme/mobile support are implemented. Artwork-only records are excluded while their discovery evidence is retained.

Playing while browsing creates a contextual queue when no explicit queue exists. Explicit queues are preserved; remove-track/Clear queue keep current playback running. Conservative idle metadata warming uses one native player, at most two starts/minute, a two-second incomplete-request cutoff, and skips video, slow/data-saving/offline/background cases. Browser buffering controls bytes; this is not a hard byte cap.

Personal playlists, likes, and bounded shared snapshot links work without login. Recipients can play and save independent copies. Four recovered Sound playlists have play/save/share/like controls: Chill n Work 23/23 matched, STØNED & STÅRVING #5 15/22, MOMINTS VOL-IV 13/14, Lofi Chill 10/10. Recovered historical positions and currently matched recordings are separate counts. Seven additional public Spinamp playlists are preserved as research; they are not mislabeled historical Sound playlists or claimed integrated.

Browsing requests a compact index; full details load only when a recording opens, with retry and stale-response protection. Vercel serves shared build-time catalog snapshots statically to avoid the Function response limit. Local API remains dynamic. Live index delivery measured 2,285,031 Brotli bytes /11,935,505 decoded, 480 ms in one cached browser run; latency is not guaranteed. Full static export 49,264,634 bytes returned HTTP 200. See `docs/catalog-delivery.md`.

## Account and payment boundaries

Dedicated local and production clients use the existing Music Nerd Privy app. Exact allowed production origin is `https://web3-music-repo.vercel.app`; local origins are 127.0.0.1:4190 and localhost:4190. Main/default Music Nerd client settings remain unchanged. Real SDK email/wallet modal passed both viewports/themes with no origin errors. **Personal email OTP, wallet signing/linking and real-account playlist save/load remain unverified user actions.**

Canonical Music Nerd identity lookup is read-only. Unknown accounts receive 409 and onboard on Music Nerd; this app never creates/merges canonical accounts. Linked wallets and browser connections remain distinct. Private Vercel Blob stores account playlists with revision/ETag conflict protection and account isolation; live synthetic persistence/concurrency/private-access checks passed. Guest playlists remain browser-local. Wallet lookup matches known supported catalog tokens/indexers, not every NFT on every chain.

Catalog financial views validate 186 Base purchases and 144 Ethereum royalty events. Gross purchases, artist/platform/referral payouts and received royalties remain separate; BigInt amounts and currencies are preserved. Historical recipients are not assumed current owners or personal income. Album allocation, all secondary sales and complete lifetime revenue are not claimed. Sound/Zora revenue recovery remains open.

## Verification, branding and next steps

167 JavaScript tests, 5 Catalog-export Python checks, syntax/format checks, static module dependency check and the production build passed. Lyrics, source/provenance panels, filters, profiles, queues and playlists were reviewed at 1440/390 px in light/dark. Production checks passed static catalog parity, inline lyrics, actual attributed Spinamp PFP loading, selected audio startup, ordered playlist Next, save-copy, and real SDK login modal. No all-track/full-listen claim is made.

The share image matches the current live Music Nerd black/pink record-sleeve styling, original lenses logo and verified SF NS system type. OG/Twitter and Lab use the new 1200×630 image; see `docs/share-image.md`. Social networks may retain older cached previews. Instagram audio/video clip export remains a proposal, not implemented functionality.

Next: finish relation/BPM checkpoints, verify newly indexed original metadata/media, target missing factory ranges, add Solana/Nina support, continue sourced comments/social/profile recovery, and test Pete's real account flow. Last install audit reported 32 transitive advisories (11 moderate/21 high); no forced breaking dependency upgrades were applied.

Core files: `archive.html`, `server.mjs`, `src/archive.js`, `src/archive.css`, `src/catalog-bundle.mjs`, `src/catalog-presentation.mjs`. Accounts: `src/account-*.mjs`/JSX and `src/personal-playlists.mjs`. Recovery: `scripts/recover-music-metadata.mjs`, `scripts/analyze-missing-bpm.mjs`, Spinamp/Supercollector scripts, and their source-specific docs. Design reference: `docs/sound-page-design-reference.md`; inspect actual approved references before changing UI.

Private environment files, account playlist objects, temporary audio and historical third-party frontend bundles remain outside Git and public deployment.
