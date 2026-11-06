# web3-music-repo

Music Nerd’s music NFT recovery app: listen to recordings, browse artists, inspect collectors and provenance, and make playlists. This is a separate project from [music-nft-era](https://github.com/xdjs/music-nft-era), whose initial catalog and research helped seed it.

## Run locally

Requires Node 22 or later.

```sh
npm ci
npm run build:account
npm start
```

Open http://127.0.0.1:4190. Browsing and browser-local playlists work without credentials. Public assets include preserved cover art and profile images; recordings stream from their original storage references. Audio files, private account playlists, environment files, and third-party frontend bundles are excluded from this repository.

Music Nerd account authentication is optional and requires the existing Privy application's allowed origin and a separately configured read-only canonical-account lookup. See [account plan](docs/account-and-wallet-plan.md). No credentials are included. Real signed-in wallet linking and account playlist save/load remain unverified; account playlist storage is local, not a production cloud service.

## Recovery and musical details

The current catalog contains 9,099 records across Sound, Catalog, Songcamp, Zora, and other collections. Records are not necessarily distinct recordings, and metadata availability is not proof of playable audio. Coverage remains partial. The [handoff](docs/RECOVERY-HANDOFF.md) identifies the remaining gaps.

Original metadata supplies BPM, key, credits, genre, label, duration, and other release details when available. Open BPM audio estimates are separately labeled; low-confidence results are withheld. Metadata and BPM scans are resumable, and network errors remain unresolved rather than becoming empty successes.

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
