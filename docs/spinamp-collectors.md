# Exact-release Spinamp collector snapshot

The public Spinamp GraphQL API does expose indexed NFT holders. For `spinamp-c4fbf6953ce75fd2a410` — Pete Rango’s “dont c∆re wh∆t they s∆y” on Lens — a bounded query on November 6, 2026 recovered **16 linked ERC721 editions held by 13 distinct indexed wallets**. Three wallets each hold two editions. This corrects the former selected-token fallback, which displayed only token 1’s holder.

The track identity is `polygon/0x4e8edD5ed83a73E73932B2787224886F206E1d88/dont-cdeltare-whdeltat-they-sdeltay`. All 16 relations have Polygon contract `0x4e8edd5ed83a73e73932b2787224886f206e1d88`, token IDs 1–16, and the identical original metadata URI `ipfs://bafybeih6f7qrhkp5yeiau7oljmq5abkpjkgtgr75e7inkiopjh4td6r2qe`. This is an explicit indexed track→NFT relationship; it does not assume every token in a contract is the same song.

`data/spinamp/collector-snapshots.json` preserves the exact public relation query and four batches of four NFT ownership queries, with response bodies and query timestamps. Both the 16-item relation page and every ownership page report no next page. `nftsCollectorsByNftId` supplies `nftId`, `addressId`, and `amount`; all 16 editions returned one row with amount 1. No API errors were hidden or converted to empty results.

The [official SDK track-NFT query](https://github.com/spinamp/spinamp-sdk/blob/a4a1da7c679fd28fc91f1f8871767024ed8be686/src/queries/nfts.ts) likewise traverses track NFTs and their owners. The [Spindexer ERC721 transfer processor](https://github.com/spinamp/spindexer/blob/dfb0108b694c6dd826934283a08fd93892ab6983/src/processors/default/createERC721NFTsFromTransfersProcessor.ts) updates these balances from indexed transfers. These source snapshots explain the schema; they do not establish the live index’s synchronization date.

## Honest boundaries

The snapshot is complete for the relations returned for this one indexed track. **It is not an independently verified current chain census, mint history, or a list of original minters.** The underlying index freshness is unknown. “Checked” is when the API was queried, not the last block indexed. No other Spinamp tracks gain broader holder coverage from this evidence, and no Solana holder support is implied.

`src/spinamp-collectors.mjs` checks source, exact query track, chain/contract/metadata identity, unique editions, complete pagination, corresponding owner queries, safe integer balances, and ERC721 conflicts. Its runtime reader requires the actual record ID, Spinamp track ID, chain, contract and original metadata URI. Invalid evidence fails closed to normal recovery. Zero addresses and zero balances are excluded.

The existing collector cards and profile enrichment are reused. The UI says “Indexed collectors” and explains the freshness limitation; no new PFP identity inference is added. Focused tests cover the 13/16 result, unrelated data, incomplete/error responses, contradictory ownership, and scoped backend selection. `scripts/verify-spinamp-collectors.mjs` checks the real endpoint/UI at 1440 and 390 pixels in light and dark themes; the browser receipt is saved only after all checks pass.
