# Listening to preserved recordings with unconfirmed NFT identity

This implementation was verified in the isolated `web3-music-indexed-release` worktree, based on main `8771478`. It is not production verification. The reviewed Spinamp candidate adds 13,288 recordings to the 37,345-record baseline (50,633 total). Candidate SHA-256: `da591054d23650ead2f4981c6b1c70a2df1af93840987ab979fc20cf95d8e395`.

These recordings retain explicit Spinamp audio references and artist identities but have no established NFT mapping. They carry `assetType: indexed-release`, `mintStatus: unconfirmed`, and source track/artist IDs. They omit chain ID, contract, token ID, mint and standard. An index's network label is displayed only as an attributed label. Index record creation is labeled “Added to Spinamp index,” never a mint or artist release date.

The existing cards, player, artist pages, search, guest playlists and share routes remain usable. Cards say “Index only”; record pages say “Mint unconfirmed”; provenance says the audio is Spinamp's preserved copy and may be transcoded. No new listening copy or transcoding pipeline was created. Original-media and onchain recovery claims do not apply to this cohort.

All metadata, owner, holder and collector reader entry points stop before provider requests and return `unsupported / unconfirmed-mint`. The collector panel explains the missing identity rather than claiming zero collectors. Index-only releases cannot acquire wallet matches, royalties, artist revenue or onchain comments. Title/artist-only historical comments are also withheld for this cohort. Token-linked indexed counts remain separate from index-only recordings; unknown networks do not become an “undefined” chain.

Stable `spinamp-…` IDs survive later exact-token promotion, keeping playlist links usable. Promotion rebuilds the record from its newly linked source, clears omitted playback overrides and old artist/credit memberships, replaces evidence, and never downgrades an existing linked entry. When both entries supply an explicit Spinamp track ID, those IDs must match. If another stable record already owns that token identity, promotion is held: the listening ID remains index-only until an explicit alias migration is implemented. This avoids duplicating an NFT identity while silently breaking neither saved recording ID.

The compact catalog includes the capability marker and mint status, while long source IDs and index network labels remain in lazy record details. The separate input is `data/spinamp/indexed-releases.json`; the loader tolerates its absence. The source candidate and portable evidence belong to the separate source-recovery change.

Verification:

- `data/indexed-release-suite-verification.json`: syntax, formatting, full tests and build results.
- `data/indexed-release-ui-verification.json`: actual API unsupported responses, server share metadata, 1440/390 light/dark provenance, collectors, comments, details, artist cards, search, guest playlist persistence and unchanged legacy token proof. No index-only ownership calls or page errors.
- `data/indexed-release-playback-verification.json`: actual app playback of Sound “express yourself” in Chromium, NOIZD “Legit Ft. ChimiChanga” in WebKit, and Zora “Bivan9do” video/audio in Chromium. All advanced past one second; Chromium reported decoded audio bytes. This is startup verification, not full-track audition or an all-recordings availability claim.
- `captures/indexed-release-*`: rendered proof and playback views. Artwork loads asynchronously; the playback capture confirms the Sound sample's actual artwork. No invented artwork or collector avatars.

Deployment must use a runtime data allowlist. The prior `data/**/*.json` inclusion exceeds the function size budget after expansion; raw discovery inputs and audit receipts are not runtime dependencies. Production integration, function bundle parity/size and live verification are owned by the release orchestrator.

## Deployed verification

Main `23dc3fb217ba856664a08b53007a1778690297fe` was staged as `dpl_FbBWnavisDM6JxLpPiU5qvo2zoZ8`, then promoted unchanged to the public aliases. `data/staging-indexed-release-summary.json` consolidates the exact catalog and five source-file hashes, four themed/viewport checks, source APIs, ownership exclusions, actual search input, guest playlist addition, legacy token proof, and three successful actual-media samples. The catalog contains 50,633 recordings, including 13,288 index-only recordings.

The first fixture incorrectly initialized localStorage in restricted third-party/opaque frames. Only that test fixture was corrected, scoping it to the app's top-level origin; application errors remain asserted. Separate receipts preserve subsequent navigation/catalog-transfer timeouts and an initial Sound startup timeout. Bounded retries after competing background analysis downloads were paused passed Sound audio and Zora video/audio in Chromium, and NOIZD audio in WebKit. These are startup checks, not full-track auditions or universal availability claims. The immutable staging hostname's blocked Privy embedded-wallet request is recorded separately; no login/OTP/signature was attempted there.

`data/production-indexed-release-alias-verification.json` passed on the primary public URL: five source hashes match, catalog HEAD/ETag matches the staged index whose complete body SHA-256 was verified, record provenance/collector guard/share responses pass, and the actual mobile dark view renders without overflow or page errors. `captures/production-indexed-release-mobile-dark.png` was visually reviewed. No full public catalog download or multi-browser playback matrix was repeated after promotion. All QA browsers were closed at completion.
