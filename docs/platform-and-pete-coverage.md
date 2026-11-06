# Platform and Pete Rango coverage audit — November 6, 2026

This is a coverage audit, not a complete discography or all-platform census.

## Pete Rango / p3t3rango

Pete confirmed `p3t3rango` as another artist name. The app now maps it to `pete-rango`, preserving each release's original artist text. Global song search and the artist directory search both recognize the alias.

Ten imported NFT records have explicit artist or collaborator attribution, alongside the separately labeled `rush` video clip:

| Release | Attribution |
| --- | --- |
| Breakdown | Pete Rango release artist |
| HONEY ft Betty Dawl | Pete Rango release artist |
| IOI ft. Alan Zavodsky | Catalog artist p3t3rango; now the same profile |
| MIAMI FREESTYLE | Mixing and mastering |
| NOT4ME | Co-production |
| Por Tu Barrio | Production and mixing |
| Christmas Presence | Instrumental arrangement, percussion, mixing and mastering |
| Yell & Scream | Co-production, mixing and mastering |
| STAR GIRL | Production and mixing |
| TK — PASSIONFRUIT | Co-production |

Five collaborator associations were missing from the app's artist relationship fields despite being present in original release notes. `data/verified-credits.json` preserves exact record IDs, source metadata URLs, short credit quotations and roles. A narrative mention of Pete organizing a picnic in Rosalie's remix notes is deliberately not treated as a musical credit.

Further leads:
- Future Surf Radio's imported Catalog mix `Ripple Effect 001` lists `Pete Rango - Peachy Dreams`. This supports tracklist inclusion, not a separate recovered mint of Peachy Dreams.
- [rush on Zora](https://zora.co/coin/base:0xc01f464c55f5b1bec05db5205d2fae9e6a835a5e) is integrated as a **20.63-second video clip**, attributed to p3t3rango. Fixed-block ERC-20 `contractURI()` reads, original IPFS metadata and downloaded media confirm its scope; browser playback passed. Coin balances bypass NFT ownership/edition views. See `docs/pete-cross-platform-recovery.md`; this is not a recovered full song.
- Mint Songs releases under either alias have not been established in this audit. No result is not proof that none exist.
- [Pete's website](https://peterango.com/) was inspected but did not provide a complete music NFT release inventory in its extracted page.

Profile attribution is separate from a claim of playback success or wallet control. Ten attributed records is not ten newly recovered songs, nor a complete catalog.

## Catalog BPM and key

At the November 6 08:56 UTC checkpoint, `data/enrichment-report.json` reports 4,036 Catalog records with 25 explicit BPM values and five musical keys; metadata reads cover all 4,036 imported records. Later listening-catalog filtering can change the displayed count. Consult the latest report rather than treating this checkpoint as fixed. The explicit `bpm` and `key` columns in Catalog's official release-metadata export were empty when inspected. This does not establish that every original token document lacks them. Open BPM is a separately labeled fallback; it does not estimate musical key.

## Platforms outside current coverage

- **Mint Songs:** a dedicated import now preserves 143 Ethereum V2 token documents plus 20 songs grouped from 22 decoded Polygon editions, before app-level deduplication. The sampled original documents contain audio, artwork and creator/edition data; none supplies BPM/key. This is bounded recovery, not every Mint Songs release. Polygon malformed JSON and unsampled token ranges remain unresolved. [Posters Season 2](https://github.com/Invisible-Goods/Posters-Season-2-by-Mint-Songs) is separate artwork and excluded from listening records. See `docs/mint-songs-recovery.md`.
- **Nina Protocol:** no Solana adapter. [Nina's own FAQ](https://help.ninaprotocol.com/hc/en-us/articles/22843950600087-Are-Nina-releases-NFTs) identifies releases as semi-fungible Solana tokens. Its releases require a different indexer/token-metadata path from our EVM adapters.
- **Async Music / Music Blueprints:** not imported. The [company's launch announcement](https://www.prnewswire.com/news-releases/async-art-redefines-music-nfts-by-launching-music-blueprints-301560382.html) and release references are leads for contract and rendered-media research. Generative editions cannot automatically be collapsed into one recording.
- **Royal:** not imported. Its [own music-product description](https://www.royal.io/work/royal-music) describes streaming-royalty ownership. Financial rights and an accessible audio asset are separate recovery questions.
- **Arpeggi:** only two records currently, not platform-complete.
- **Sound / Catalog / Zora / Songcamp:** present but partial. Zora creator/coin coverage, Sound Base/Polygon scans, legacy contracts and Songcamp collections beyond the selected CHAOS records remain incomplete.

OneOf, Pianity, Glass, Lens music publications, Tezos music collections and independent/custom music contracts remain additional research candidates, not audited or imported coverage.

Validation: alias maps to one artist without changing original release labels; ten attributed records appear on Pete's page and through both search terms; mobile/desktop and light/dark checks pass. See `data/pete-alias-ui-verification.json`.

Production and identity note: the project was originated by **Pete Rango**. His public linked Zora wallets are research inputs, not proof that every held token is his creation. The listening app is deployed at https://web3-music-repo.vercel.app; newest local changes still require the final release verification.


## Later November 6 additions

Six additional recordings are now included, bringing Pete's attributable list to 17 including the short rush clip: Dreamvibe; Savage Planet visualizers Planet X, Tragg Park and Oms at Play; Evermore DEMO Tape REIN X Pete Rango; and Mavi Taylor — Say it celly (Pete production credit). Exact token reads and decoded-audio playback are documented in [expanded Zora recovery](pete-zora-expanded.md). The earlier ten-record table is the starting cohort, not the current total.

All 15 Keepers Of Wisdom Base token metadata documents contain images only; the collection-level video preview was not treated as a song attachment. OpenSea holdings provide discovery leads, not artist authorship. New Base music contracts from those holdings need factory/platform verification.
