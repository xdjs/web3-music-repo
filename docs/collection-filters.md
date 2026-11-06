# Collection filters

My collection reuses Explore’s filter controls for platform, network, collection, media type, and sort, with a search field for song, artist, or collection. Results combine the selected wallet’s loaded network pages into one grid, initially showing 40 recordings. Network status, retry, and pagination remain available below the results.

Explore’s **My collection** toggle intersects those same catalog filters with exact record IDs returned by the wallet index for the signed-in account’s linked Ethereum-compatible wallets. Public wallet lookups are not added to this set. Created or credited recordings do not count as collected unless the wallet results identify ownership. Removing a linked wallet removes its matches; signing out clears the account’s matches.

Automatic lookup is bounded to the first page on each supported network for the first five linked wallets, with two concurrent requests. Further pages require an explicit action. The interface reports partial results, pending checks, and provider errors; zero matches does not establish that a wallet has no music NFTs. Solana wallet ownership remains unsupported, including Nina holdings.

## Verification

- Eight focused state/filter tests passed, covering intersections, sort immutability, escaped controls, linked/public wallet isolation, unlink/logout, concurrency, and request bounds.
- `scripts/verify-collection-filters.mjs` exercises the actual app with mocked Privy and wallet-index responses. It verifies search focus, media/network/platform filters, sort, linked-wallet union, public-wallet exclusion, provider-error disclosure, and logout. This is UI/state verification, not verification of a real account’s holdings.
- `data/collection-filter-verification.json` records passing 1440px and 390px checks. The eight `captures/collection-filters-*` and `captures/explore-owned-*` screenshots were visually reviewed in light and dark themes. They reuse the existing controls and surfaces without horizontal overflow. Some remote cover images remained placeholders during capture.
- The separate `data/mini-art-recovery-verification.json` confirms that a failed compact-player artwork request followed by MIAMI loads the new 1500px image and restores its visibility. `captures/mini-art-after-failure.png` was visually reviewed.

No new ownership inference or full-wallet completeness claim is introduced.
