# web3-music-repo

Music Nerd’s music NFT recovery app: listen to recordings, browse artists, inspect collectors and provenance, and make playlists. This is a separate project from [music-nft-era](https://github.com/xdjs/music-nft-era), whose initial catalog and research helped seed it.

Created and originated by **Pete Rango**, with implementation and recovery assistance from Codex.

Live app: **https://web3-music-repo.vercel.app**. [Music Nerd Lab listing](https://lab.musicnerd.net/peterango/music-nft-recovery). Publication is separate from a claim of complete platform recovery.

## Run locally

Requires Node 24.

```sh
npm ci
npm run build:account
npm start
```

Open http://127.0.0.1:4190. Browsing and browser-local playlists work without credentials. Public assets include preserved cover art and profile images; recordings stream from original storage references or explicitly labeled audio preserved by an indexer. Audio files, private account playlists, environment files, and third-party frontend bundles are excluded from this repository.

Music Nerd authentication uses dedicated local and production clients within the existing Privy app, with a read-only canonical-account lookup. Existing linked wallets surface on My profile and automatically load My collection; public wallet lookups also accept ENS names; adding a wallet uses Privy ownership verification. Production account playlists use private Vercel Blob storage with revision checks; guest playlists remain browser-local. See [login status](docs/privy-login-status.md). No credentials are included. Pete has confirmed real sign-in and linked-wallet display. Cross-device account playlist save/load and linking a new wallet still need user verification. Ethereum and Optimism wallet lookups returned known songs; Base, Polygon and Zora currently have provider failures shown as unavailable, not empty collections.

Playback includes contextual queues, shuffle, drag/keyboard queue ordering, and one-track-ahead native buffering. Buffering prioritizes the current song and skips slow/data-saving/background cases; remote media can still be slow or unavailable. See [queue controls](docs/queue-reordering.md) and [buffering limits](docs/next-track-buffer.md).

## Recovery and musical details

The latest November 6 listening-catalog checkpoint contains 31,220 records across Sound, Catalog, Mint Songs, Songcamp, Zora, Supercollector, Lens, and other collections. Counts change as recovery and media classification improve; consult the timestamped `data/enrichment-report.json` and live recovery ledger before quoting them. Records are not necessarily distinct recordings, and metadata availability is not proof of playable audio. Coverage remains partial. The [handoff](docs/RECOVERY-HANDOFF.md) identifies the remaining gaps.

Original metadata, publisher snapshots, official release pages, and attributed indexer data supply BPM, key, credits, genre, label, duration, and other release details when available. This checkpoint has 7,942 supplied BPM values, 7,519 musical keys and 1,311 tracks with inline lyrics. Audio-derived BPM estimates remain separate. The new imports include 616 eligible public Supercollector tracks and 21,395 exact NFT-linked Spinamp additions; the full 52,987-entry Spinamp discovery inventory is not a claim of complete app imports or playback verification. The completed first Open BPM pass contains 5,666 separately labeled estimates; 193 low-confidence results are withheld, 1,773 sources remain unavailable, and 22,017 newer records have not entered that analysis run (supplied BPM is skipped). Metadata and BPM scans are resumable, and network errors remain unresolved rather than becoming empty successes.

```sh
npm run recover:metadata
npm run analyze:bpm
node scripts/report-enrichment.mjs
```

Run only one writer per output file. `work/` contains temporary metadata/audio caches; completed audio downloads are deleted after analysis. The BPM worker uses FFmpeg and FFprobe plus Open BPM. Install Rust/Cargo separately. `cargo install open-bpm` returned “package not found” during verification, so the tested source build was:

```sh
cargo install --git https://github.com/fabriziosalmi/open-bpm --rev 73a3e6ef33f5c9d4131d118b14dcd4da73ec1775 --locked --bin open-bpm
OPEN_BPM_COMMIT=73a3e6ef33f5c9d4131d118b14dcd4da73ec1775 npm run analyze:bpm
```

`OPEN_BPM_BIN` can specify an executable. `--limit=N` limits a run; `--retry` includes unsuccessful attempts without replacing completed estimates. The worker analyzes full accessible media up to 256 MB and 30 minutes, excludes artwork-only tokens, and stores file hashes, duration, confidence and source. Longer/unreachable files remain unresolved. The default tempo search range is 60–200 BPM and can produce half/double-time estimates.

Browsing loads a compact public catalog; recording pages fetch full details on demand. Vercel serves deployment-specific public catalog snapshots through its static CDN. See [catalog delivery](docs/catalog-delivery.md), [lyrics recovery](docs/lyrics-recovery.md), [Spinamp recovery](docs/spinamp-recovery-plan.md), and [Supercollector coverage](docs/supercollector-recovery.md).

## Payments

Catalog's [official March 9, 2026 export](https://github.com/catalogworks/catalog-squidward-data) contains purchase and payout history. The recovery checks exact token-purchase events and USDC transfers in successful Base transaction receipts, using the historical payout configuration. Song pages separate gross purchases from artist, platform, and referral amounts, with transaction links.

This is a partial historical payment view, not lifetime artist income. Artist recipients can be split contracts; album purchases, secondary sales and later transactions are not included. Sound/Zora revenue recovery remains future work.

```sh
npm run recover:catalog-payments
```

## Verify

```sh
npm run check
npm run format:check
npm test
# With the server running:
npm run test:browser
node scripts/verify-profile.mjs
node scripts/verify-music-details.mjs
node scripts/verify-onchain-comments.mjs
```

Browser checks depend on live media/RPC availability. Data and screenshots in this repository are checkpoints; they do not update automatically when a local recovery job continues. Music, artwork, names and original metadata remain attributed to their original creators and sources; repository publication does not grant new rights to them.
