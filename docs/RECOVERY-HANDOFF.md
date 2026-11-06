# Music Nerd music NFT recovery — agent handoff

Checkpoint: November 5, 2026, Pacific time (verification timestamps are November 6 UTC).

## Start here

Pete requested a stopping point and explicitly authorized publishing this handoff to GitHub. Continue the existing recovery app; do not restart the project or replace the documentary.

**The dedicated public repository is now https://github.com/xdjs/web3-music-repo . The working recovery implementation and recovered data are still local; the initial repository publication contains this handoff only.** A remote agent needs the local workspace or a separately reviewed code/data transfer before it can implement changes. Never assume this repository's main branch contains the recovery app.

Local workspace:
```sh
cd "/Users/peterarango/Documents/Music Nerd/Apps/music-nft-recovery"
npm run dev
```

Preview: http://127.0.0.1:4190 . Server was restarted successfully at this checkpoint. Check for an existing listener before starting a second server. The app binds to loopback and defaults to port 4190.

The working directory has no Git repository. The original documentary checkout at `/Users/peterarango/Documents/Music Nerd/Music NFT Era` points to `xdjs/music-nft-era` and is heavily dirty. Preserve it; do not reset it, stage everything, or overwrite it. Use an isolated checkout for any eventual publication. No production deployment or production database writes were performed.

## Resumed work — November 5 evening / November 6 UTC

- Pete selected a separate public repository, `xdjs/web3-music-repo`; it is not the NFT Era documentary repository.
- The 61 Zora candidate comments were verified against the official fixed-price minter deployment and matching mint transfers in successful receipts. An explicit end block and block hash were saved.
- 44 of the verified messages match 15 existing catalog tokens. The others remain saved without being attributed to a different song.
- `scripts/recover-zora-onchain-comments.mjs`, `src/zora-comments.mjs`, `data/zora-onchain-comments.json`, and `evidence/zora-comments/` contain the pipeline and evidence.
- Song comments now separate onchain mint comments from Sound web-archive comments. The event wallet is labeled as mint recipient, not assumed author.
- New adversarial provenance tests pass; total unit tests now 50. Browser checks passed at 1440px/390px in light/dark: nine exact-token comments on Imagine, no overflow, no tab-scroll jump, and Sound comments remain separately labeled. Evidence: `data/zora-comments-ui-verification.json`.
- `data/park-missing-token-reads.json` has successful current metadata reads for The Park token 1 (trailer) and token 12 (Onchain Summer), not yet integrated. Unmatched comment tokens also include 18 and 19.

The sections below preserve the previous checkpoint; the resumed-work section supersedes its candidate-verification and repository-location statements.

## Product intent and approved direction

This is a listening archive and a demonstration of what can be recovered from blockchains and surviving metadata. Recover Sound first, then expand across Catalog, Zora and other music NFT collections. Include Pete Rango, use the Music Nerd lenses logo, and keep music, artists, collectors and their context easy to explore.

Reuse established Sound organization and Music Nerd controls, typography, themes and spacing. Inspect the closest approved implementation before UI changes, and verify actual rendered desktop/mobile/light/dark results. Do not represent unverified styling as finished.

Latest requests:
- Smooth song tab changes without scroll/layout jumps.
- Compare artist/song organization against actual historical Sound screens.
- Remove “MUSIC, STILL HERE.” from the top bar.
- Surface song collectors, recovered PFPs and collector profiles.
- Recover more comments/context and attach them to songs/artists instead of a standalone community-memories section.
- Improve compact platform/network/media/collection filtering.
- Use Music Nerd Privy accounts, link existing/external wallets, and listen to collected music.
- Keep expanding Zora recovery without claiming every music NFT can be identified.

## Working implementation

- Artist/title/collaborator search; persistent audio/video player, queue, likes and editable browser-local playlists with export.
- Platform tabs: All, Sound, Catalog, Zora, Other platforms. Network/media/sort controls; collections under More filters.
- Artist pages, sourced social links, song comments matched by artist/title only when a historical release identity is unambiguous.
- About this archive moved to sidebar/page footer; top-bar slogan removed.
- Music Nerd lenses asset: `public/musicnerd-lenses.png`.
- Same-song tabs now update the tab panel and selected state without replacing the hero or resetting scroll.
- Historical-style release hero: title/play at left, artwork at right on desktop; responsive mobile layout.
- Artist banner/overlapping avatar/identity layout; Daniel Allan's historical banner and bio recovered. Most artists still lack recovered banners.
- Song collectors use exact verified release scope. Legacy artist contracts require edition mapping; never attribute all artist-contract holders to one song.
- Collector profiles combine attributed historical Sound identity with current forward-verified ENS where available. Missing avatars retain labeled placeholders.
- Public Collected music wallet screen scans supported Blockscout networks with per-chain paging/retry and exact archive matches. Existing song controls support playlist addition.

## Last fix and verification

Legacy “Too Close” has its relevant edition tokens after four pages of unrelated artist-contract tokens. The server intentionally reads at most four pages per request. The UI previously treated that first empty result as the end.

`src/collectors-ui.mjs` now continues through empty pages with a bounded retry/page count and preserves the next-page control if more remain. It no longer labels an unfinished scan as an empty final snapshot.

Browser check after the fix:
- Daniel Allan / Too Close: **24 collector cards and 7 loaded PFP images**.
- Removed slogan absent.
- Evidence: `data/song-collector-ui-verification.json`, `captures/too-close-collectors-current.png`.
- Script: `node work/check-song-collectors.mjs`.

Other verification:
- **47/47 unit tests passed**, `npm run check` passed, `npm run format:check` passed at the checkpoint.
- Same-song Details/Comments/Provenance/Collectors cycling preserved tab-bar and scroll positions within 2px.
- Real Ethereum wallet sample: 48 indexed token entries mapped to seven archive recordings; nine token entries unmatched. This was one wallet/network, not a complete multi-chain test.
- Evidence: `data/wallet-ui-verification.json`; `work/verify-tabs-wallet.mjs`.
- Earlier baseline: 215/232 starting catalog records advanced playback; 11/12 additional Sound samples passed; Catalog samples 2/3 passed. These are browser playback-start checks, not full-track auditions or entire-catalog proof.
- Full browser suite was not rerun at this final checkpoint; do not imply it was.
- Latest artist/release layout screenshots reviewed on desktop/mobile. Verify light/dark again after future UI changes; historical mobile references remain missing.

## Recovery totals and their limits

| Area | Saved result | What it does not prove |
| --- | --- | --- |
| Combined archive | 9,096 records; 1,930 artist identities; 60 artwork-only records | Not unique songs or a complete era-wide census |
| Sound ETH/OP factories | 9,488 known deployments: 172 legacy artist contracts, 9,316 modern release contracts | Permissionless deployments do not prove Sound website listings |
| Sound metadata | 4,699 modern representative metadata records; 276 legacy editions | Not every token tier/variant |
| Sound remaining | 3,361 verified unminted contracts; 1,256 unresolved attempts | Empty representative audio does not mean no tier has music |
| Historical comments | 2,878 comments across 83 releases | Web-archive evidence, not onchain comments |
| Historical identities | 2,162 wallet-linked profiles; 1,053 locally preserved PFPs | Not every collector or current wallet identity |
| Catalog snapshot | 4,164 official token entries: 2,499 Ethereum + 1,665 Base | Snapshot dated March 9, 2026, not every release through today |
| Catalog metadata | 4,106 supported media references; 2,970 successful current contract metadata reads | References/metadata are not playback success |

Catalog source: https://github.com/catalogworks/catalog-squidward-data .

Sound unresolved diagnosis: 1,201 representative metadata documents had empty audio fields, 47 remained unavailable, eight had media references needing integration/retry. A previously unresolved item was recovered during diagnosis. Respect the manifest/report timestamps and avoid mixing cohorts.

Base/Polygon known Sound V2 runtime validation succeeded after normalizing declared immutable slots, but historical event scans remain incomplete due provider limits. Reattempt with suitable providers; never convert provider errors into empty successful coverage.

The archived Chill n Work playlist preserves 23 ordered track IDs and 16 resolved entries; seven remain unresolved. Do not invent entries or claim full playlist recovery.

## Historical Sound references actually inspected

Artist capture:
https://web.archive.org/web/20230204185752/https://www.sound.xyz/danielallan

Song capture:
https://web.archive.org/web/20230531114933/https://www.sound.xyz/danielallan/too-close

Local evidence:
- `evidence/reference-screens/artist-historical.png`
- `evidence/reference-screens/song-historical.png`
- `work/sound-artist-reference.json`, `work/sound-song-reference.json`
- `docs/sound-page-design-reference.md`
- `captures/artist-reference-desktop.png`, `captures/artist-reference-mobile.png`
- `captures/release-reference-desktop.png`, `captures/release-reference-mobile.png`

Observed artist structure: banner, overlapping profile image, identity/stats, bio, collector/playlist/activity sections. Some archived widgets did not hydrate; the capture does not establish complete list order or contents.

Observed song structure: wide dark hero, artwork at right, Details/Activity, Behind the music, Audience, Rewards, Contract Details. The archive retains Comments/Collectors/Provenance as useful additions. Do not restore mint/follow/reward controls without functioning support.

Remaining visual work: better hydrated later artist captures, artist collector/playlist sections, additional banners and historical mobile screenshots. Current work is aligned in part, not a complete historical reconstruction.

## Zora: immediate promising next step

There is no verified universal “all music” classification established here. Zora protocol NFTs exist on multiple chains; the Zora network alone is not the whole protocol. Discover contracts/events, inspect token metadata/media types and preserve ambiguous candidates.

The initial Blockscout-based comment scan of 25 selected records yielded two indexed no-log results and 23 unavailable results (Zora 404, Base 403). This is an indexer-access failure, not evidence of no comments.

**A direct RPC probe then returned 61 MintComment candidate logs for The Park collection on Zora. The raw response is now saved.**

- RPC: https://rpc.zora.energy
- Chain: 7777777
- Collection: `0x91dccffe742653fb533f8b5aca94ef2aa58e25b4`
- Event: `MintComment(address,address,uint256,uint256,string)`
- Topic filters: signature, any sender, padded collection address.
- Observed emitter: `0x04e2516a2c207e84a1839755675dfd8ef6302f0a`.
- Probe: `work/probe-zora-rpc.mjs`.
- Saved evidence: `data/zora-rpc-comment-probe.json`.
- Initial indexer results: `data/zora-comment-candidates.json`, `scripts/recover-zora-comments.mjs`.

**These 61 are candidates, not integrated/authenticated song comments yet.** Verify the emitter against official Zora deployments/source, pin an explicit end block, decode the event, match exact contract/token IDs, and deduplicate by chain + transaction hash + log index. Retain source and block evidence. The probe used latest and is not a reproducible full-chain census.

Official references to inspect:
- https://nft-docs.zora.co/contracts/intro
- https://github.com/ourzora/zora-docs/blob/main/docs/smart-contracts/creator-tools/events.mdx

The formerly documented `zora-protocol/packages/1155-deployments/addresses` path returned 404; locate current official deployment evidence instead of trusting a guessed URL.

## Accounts and wallets: implemented vs blocked

Implementation:
- `src/account-login.jsx`, `src/account-wallets.jsx`, `scripts/build-account.mjs`.
- Uses the existing Music Nerd production Privy application; email and EVM wallet authentication enabled.
- Lists `user.linkedAccounts`, including linked wallets not connected in this browser. Browser wallet connection state is separate.
- Add wallet uses Privy linking; connect existing wallet uses its connect flow.
- Linked EVM wallets link to `#wallet/<address>`.
- Server checks signed Privy JWT issuer/audience/expiry and resolves canonical Music Nerd identity through read-only DB lookup.
- Explicit account playlist save/load is isolated by user and revision-checked.

Blockers:
1. A real user login failed with **Privy 403 invalid_origin** for `http://127.0.0.1:4190`. Pete was asked to add that exact allowed web origin. No completion was confirmed. Real email login, account playlist save/load, and wallet linking remain unverified.
2. Unknown canonical Music Nerd users receive 409 and must first establish their account in Music Nerd. Account creation/merging is not implemented here.
3. Account playlists are stored privately on this local server. They are not durable serverless/cloud storage.
4. Wallet library only resolves known archive matches. Arbitrary wallet NFT media recovery and complete all-chain scans remain unfinished.
5. Last audit reported 29 transitive vulnerabilities (11 moderate, 18 high) in the wallet dependency tree. No forced breaking downgrade was attempted; reassess before deployment.

Secrets remain in ignored local environment/private storage. Never publish environment values, DB credentials, auth tokens, email codes or private user playlist data. Do not write to the production Music Nerd database to “finish” login.

## File map and resume commands

UI and service:
- `archive.html`, `src/archive.js`, `src/archive.css`, `server.mjs`
- `src/collectors-ui.mjs`, `src/collector-profiles.mjs`
- `src/recovery-collectors.mjs`, `src/legacy-collectors.mjs`
- `src/wallet-library.mjs`, `src/wallet-library-ui.mjs`
- `src/personal-playlists.mjs`
- `data/artist-presentation.json`

Recovery:
- `scripts/census-sound.mjs`
- `scripts/expand-sound.mjs`
- `scripts/recover-legacy-editions.mjs`
- `scripts/recover-representatives.mjs`
- `scripts/recover-more-sound-captures.mjs`
- `scripts/expand-archived-comments.mjs`
- `scripts/enrich-comment-owner-profiles.mjs`
- `scripts/cache-sound-avatars.mjs`
- `scripts/write-recovery-report.mjs`

Read `docs/recovery-report.md`, `docs/account-and-wallet-plan.md`, `docs/profile-recovery.md` and `docs/sound-page-design-reference.md`. This handoff supersedes older status prose: the report's general “wallet-library unfinished” statement predates the working public sample, and its collector evidence predates the final pagination fix.

```sh
npm run check
npm run format:check
npm test
node work/check-song-collectors.mjs
node work/verify-tabs-wallet.mjs
```

`npm run test:browser` runs additional existing flow checks and requires the preview server. Live sources can fail or rate-limit; record failures honestly.

The local `run.cjs`, `work/live.mjs` and `work/diagnose.mjs` are temporary wrappers that were repointed during investigation. Read their contents before executing them; prefer named scripts. Run only one writer per recovery output.

## Recommended next order

1. Confirm this local workspace is available; if the next agent is remote, arrange a reviewed transfer of code/public evidence, excluding secrets, private data, dependencies and recovered third-party frontend bundles.
2. Preserve the verified tab/collector fix. Check the complete Details/Comments/Collectors navigation and light/dark/mobile layout again after further edits.
3. Authenticate/decode the 61 saved Zora candidate events and integrate exact song-level onchain comments with provenance.
4. Finish historical artist-page organization using actual captures, then continue banners/PFP recovery.
5. Resolve the Privy allowed origin with the user, perform real signed-in save/load/link tests, then design durable storage and account onboarding.
6. Expand Sound Base/Polygon historical scans and remaining metadata tiers; broaden Zora and wallet matching. Keep census and playback completeness claims separate.
7. Prepare an isolated, secret-reviewed code publication/deployment only once those scopes are explicit.

No background recovery job is intentionally left running at handoff. The local preview server remains available.

