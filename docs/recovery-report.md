# Recovery report

Generated 2026-11-06T04:34:42.606Z. Open http://127.0.0.1:4190.

## Recovered and integrated

- 9096 catalog records, including 60 artwork-only collectibles labeled without play controls.
- 9488 factory-created contracts across Ethereum and Optimism: 172 legacy artist contracts and 9,316 modern release contracts. All index pages were read through the blocks recorded in the census manifest.
- 4699 modern contracts with recovered representative metadata; 276 legacy artist editions recovered. Representative tokens are not a complete enumeration of all token variants.
- 3361 contracts verified with zero minted tokens; 1256 attempted contracts remain unresolved. Factory deployments are permissionless and do not by themselves prove a Sound website listing.
- 2162 archived wallet-linked profiles; 1053 avatars preserved locally. Historical images and current forward-verified ENS identities are separately attributed.
- 2878 archived comments across 83 releases. These are web-archive evidence, not onchain recovery.
- Pete Rango's Breakdown recovered and playback-tested, alongside the original documented production credits.

## Catalog Works

Official March 9, 2026 export: 4164 token entries (2499 Ethereum and 1665 Base), excluding testnets. 4106 entries preserve supported media references; 2970 have successful current contract metadata reads as of this report. Token entries are not unique-song totals, and media references are not playback proof. Browser playback samples: 2/3 passed. These are start checks, not full-track auditions. This snapshot does not establish all releases through today. Source: https://github.com/catalogworks/catalog-squidward-data .

## Sound metadata diagnosis

Of the previously unresolved representative reads, 1201 returned metadata with empty audio fields, 8 returned a media reference needing integration/retry, and 47 remained unavailable. These are representative-token observations, not proof that no other token tier has audio.

## Working product

Artist/title/collaborator search, persistent audio/video playback, player queue, likes, editable local playlists with export, artist pages and sourced links, song-level collectors, collector profiles, matched song comments, archived playlist, evidence export, light/dark themes and mobile layouts.

Modern collectors are scoped to verified release factories. Legacy collectors filter NFT instances through the contract's edition-ID encoding or tokenToEdition reads; uint256 IDs and pagination cursors retain their full precision. These are current indexed holders, not original minters.

## Verification

215/232 starting-catalog records advanced playback in Chromium; 11/12 additional modern/legacy samples passed. Checks start the real original media; they are not full-track auditions. Failures remain in the audit files. Two starting-catalog entries identify artwork-only metadata.

Browser flows verified search, playback, playlist persistence/reordering/next, collector pagination and profiles, live contract reread, matched song comments, desktop/mobile and light/dark layouts. A legacy release check recovered 24 wallets holding its 25 edition tokens.

## Explicit gaps

- Base and Polygon canonical V2 factory runtime matches the verified source after normalizing only declared immutable slots. Historical event scans are incomplete because public RPC/indexer access was limited. No zero-collection conclusion is drawn.
- Unknown factories, out-of-factory clones, all mint/transfer history, all token variants, every missing media file, and a complete Sound social graph are not established.
- The archived Chill n Work playlist retains 23 ordered IDs but 16 detailed entries (15 from the playlist page and one recovered by exact track ID from a July 2022 capture). Seven track IDs remain unresolved; missing pages were not invented.
- Browser-local playlists work. Music Nerd production Privy email sign-in is configured and its login UI verified. The server validates signed tokens and resolves the canonical Music Nerd user through a read-only database connection. Explicit account playlist save/load uses private storage on this archive server with revision conflict checks. A real login attempt failed with Privy 403 invalid_origin: http://127.0.0.1:4190 is not allowed by the production app. Real signed-in save/load remains unverified until that origin is configured and the user completes email authentication. This is not durable serverless cloud storage. Full wallet-library listening remains unfinished.
- Local preview only; no production deployment or outbound publication was performed.

## Reproduce and resume

`node scripts/census-sound.mjs` regenerates known Ethereum/Optimism factory inventories. `node scripts/expand-sound.mjs` resumes representative metadata recovery. `node scripts/recover-legacy-editions.mjs` enumerates legacy editions. `node scripts/recover-representatives.mjs` checks mint state and alternative representative tokens. `node scripts/write-recovery-report.mjs` refreshes this report. Network access is required. Run only one writer per output file.

The original dirty documentary checkout is preserved. Evidence and local implementation are under the isolated music-nft-recovery workspace.
