# Public collector discovery and collection sources

Collector discovery is public read-only. It does not require account sign-in, a signature, or adding a wallet to a private Music Nerd account.

## Search

`GET /api/collector-search?q=...` returns explicit address-bearing results with `sourceType` of `wallet-address`, `ens`, or `historical-sound`. Full addresses are accepted immediately. ENS uses the existing forward resolver with arbitrary resolver-controlled HTTP/CCIP fetching disabled. Historical names and Sound URL handles are searched across 2,162 preserved profile rows; matches are not identity merges. Two wallets with the same display name remain two results. A historical `.eth` display name is distinct from the current ENS address if the resolver maps it elsewhere.

Output includes `status`, `query`, `items` (maximum 20), `total`, `truncated`, and optional `ens`. Upstream ENS failure yields `partial` when historical results remain, otherwise `unavailable`; it never manufactures a resolved identity. ENS requests deduplicate in flight and cache for 5 minutes (15 seconds for failure). The UI requires explicit selection for ambiguous names.

## Profile collection data

Existing `/api/collector/:address` still returns the public profile and comments. It now adds `snapshotHoldings`, recovered from Catalog’s exported balances/purchase history and validated exact-release Spinamp evidence. These appear independently of prior visits to a song’s collector tab. Historical purchases are labeled purchases, not current balances. Existing `observedHoldings` retains matches from already-loaded holder pages with their source scopes. Neither field is a complete current wallet inventory.

Current indexed EVM holdings continue through `/api/wallet/:address?chainId=...`, for Ethereum, Optimism, Polygon, Base and Zora. The collection UI keeps these checks separate from snapshots, preserves partial results and exposes retry/pagination.

## Spinamp music index

`GET /api/collector/:address/collection?source=spinamp&cursor=...` loads one 20-NFT page. It follows the official SDK’s [wallet→NFT→track relation](https://github.com/spinamp/spinamp-sdk/blob/a4a1da7c679fd28fc91f1f8871767024ed8be686/src/queries/collection.ts), with explicit positive wallet balances, NFT identity validation, bounded nested relations and pagination. Queries go only to `https://api.spinamp.xyz/v3/graphql`.

The response has `status:indexed`, `scope:spinamp-wallet-index`, `indexFreshness:unknown`, `onchainVerified:false`, `items`, `nextCursor`, `checkedAt`, `loadedNfts` (this page), `totalIndexedNfts`, `unmatchedNfts`, `unsupportedNfts`, and `incompleteTrackRelations`. `checkedAt` is query time, not the block synchronization date. Each item carries a matched recording ID plus exact NFT identity and indexed quantity. Several held NFTs can match one recording, or one NFT can link several recordings; item/track counts must not be treated as distinct NFT counts. `sharedAsset` flags the latter.

Matching permits an explicit processed-track relationship within the exact chain/contract, an exact token, a verified single Sound release contract, or a legacy edition ID. It never attributes an entire arbitrary shared artist contract to a song. Solana holdings are not implemented by this endpoint; unsupported assets are counted explicitly. Nina listening support does not imply Solana wallet support.

Cursors are bounded and wallet-bound; repeated provider cursors, partial ownership evidence, wrong owners, malformed identities/balances, HTTP failures and GraphQL errors remain retryable failures rather than empty successful wallets. Successful pages cache for 60 seconds, failed pages for 10 seconds, and simultaneous requests deduplicate. Nested track relations cap at 5 per NFT and disclose remaining relations. No background full-wallet crawl is started.

## Verification

New tests cover ambiguous names, explicit addresses, ENS/history disagreements, failure preservation, result limits, concurrent request deduplication, historical holdings without prior page visits, exact track/contract boundaries, wallet-bound pagination, safe balances, shared assets, incomplete relation counts, provider failures and cache lifetimes. Existing holder and Solana capability regressions also pass.

A real two-page probe of the public Pete Rango wallet returned 256 indexed NFTs in total. The first 40 were read: 31 NFTs matched 19 distinct recovered recordings; 9 had no match in this catalog. Page timings were 605 ms and 304 ms on this workstation. More pages remained and were not scanned. `data/collector-index-verification.json` records those counts and limitations. UI and full endpoint verification are recorded separately by the UI agent; this document does not assert deployment.
