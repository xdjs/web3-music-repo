# Nina Protocol recovery audit

Read-only inspection of the saved Spinamp inventory, compact NFT relation checkpoint, artist atlas and frozen import audit on 2026-11-06. No API requests, RPC scans, chain-adapter implementation or catalog changes were performed.

**Nina is discovered but is not included in the current playable import.** The cached inventory contains **6,206 Nina processed tracks** associated with **1,818 artist IDs**. All 6,206 representative relation lookups completed: **6,204 returned linked NFT records**, and **2 returned empty results**. There are no pending Nina provider failures. The frozen audit excludes those groups as `unsupported-or-invalid-nft-identity` and `no-indexed-nft`, respectively; this is separate from the 169 still-unresolved non-Nina requests.

All 6,204 linked records have distinct **32-byte base58 Solana mint addresses**, `chainId: solana`, `standard: metaplex`, and null numeric token IDs. Their NFT ID, `contractAddress`, processed-track `solana/<mint>` suffix and platform-internal ID agree exactly. These remain **Spinamp index assertions**, not independent current-chain reads.

All 6,204 linked records also have original-media and metadata references; every original-media URL passes the existing storage adapter. Of these, 6,202 use `https://www.arweave.net/`, which is already permitted as an Arweave subdomain. All 6,206 inventory rows retain processed-audio URLs and IPFS hashes, including the two without linked NFT evidence. **Media-reference presence is not proof of current playback.** No Nina media was fetched or auditioned during this audit.

Positive indexed durations exist for **5,094 inventory rows**, including **5,092 linked records**. The other **1,112** have zero/unknown duration, and all 6,204 linked NFT MIME fields are null. A strict first candidate cohort following the current duration/MIME evidence gate would therefore start at 5,092 linked records, before playback checks and cross-source deduplication. A bounded decode pass can evaluate the remaining 1,112 without pretending zero means an empty recording. Every admitted recording needs native decoded-dimension handling (`videoWidth`/`videoHeight`) so extensionless video is not mislabeled audio merely because MIME is absent.

The compact cached metadata contains **4,821 descriptions**, but **zero extracted BPMs, musical keys or structured credits**. This only describes this saved extraction, not every field in original Nina metadata or possible collaborator names in prose. Titles, artist IDs/names, media, artwork, metadata pointers and release links are present. All 1,818 artist IDs match the saved public atlas, but none has an avatar IPFS hash there. Some descriptions contain HTML and must remain escaped or sanitized.

## Mint and release identity example

“Igor Dyachenko — Error Handling” has:

- Indexed Solana mint: `122gW5E6uqWKEsb1KdCjVhWtarbCTdN7hR1bjt9dgdaw`.
- Public release URL: `https://nina.market/CZ2wpojt6YHhPPaGJNUuyXPAFDwGjEK1tbJHipcMT1Wn`.
- Artist authority/index ID: `8pDRnuwt5WALrU36vpgiYDpsqbyMQUUQ4dQdGh25WakD`.
- Metadata: `https://www.arweave.net/JlNrHJ5HW6KUKrWX7Sgd0Lh0U4j6h18k7Z4bZZ--w7k`.
- Media: `https://www.arweave.net/coo4iW7R26I1GmlCeimuWuRAY8_8M9wSym_XQFwYlc4?ext=mp3`.

The release address in the public URL differs from the mint. Preserve both; do not derive a release address from a mint or invent token ID zero. The two empty relations are Aliese's “Are You Good?” and God's Mom's “God's Mom - S/T”; their indexed audio survives, but their mint identities must not be inferred from the processed ID alone.

The inspected official [Spindexer Nina trigger](https://github.com/spinamp/spindexer/blob/dfb0108b694c6dd826934283a08fd93892ab6983/src/triggers/nina.ts) discovers Nina release accounts, reads each `releaseMint`, and retrieves Metaplex metadata. The [NFT processor](https://github.com/spinamp/spindexer/blob/dfb0108b694c6dd826934283a08fd93892ab6983/src/processors/default/createNinaNftProcesor.ts) stores that mint and uses release authority as the artist ID. This source snapshot is from 2022 and supports interpretation of the cache; it is not fresh verification of every current deployment. Its metadata-date processor can populate timestamps from metadata properties, so an indexed date must not automatically become a verified mint-block timestamp.

## Smallest safe integration

1. Add a case-sensitive Solana asset identity (`network: solana`, mint, Metaplex standard), separate from EVM contract plus token ID. Current EVM lowercase normalization, explorers, RPC selectors, collector queries and wallet matching must not run on Solana keys.
2. Prepare an explicitly indexed Nina listening cohort from existing references, preserving artist IDs, mint versus release distinction, original versus processed-media provenance and unknown dates. Begin with a bounded native playback sample across old/new Nina links and duration states. Do not claim all 6,206 are playable or all Nina releases are represented.
3. Enable catalog/search/artist/media rendering for that asset type, then add independently verified mint/metadata reads and SPL-token-holder collection support separately. Collector profiles, wallet-owned Nina collections, balances and royalty revenue require Solana-specific handling; importing audio alone does not deliver those features.

No full discovery scan is necessary to start this work. The existing cache supplies the candidate identities and media; deployment can remain independent of implementing Solana collection ownership.
