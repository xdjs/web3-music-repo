# Catalog original metadata audit — November 6, 2026

Catalog had metadata. The earlier enrichment pass failed to reuse **2,499 original Ethereum token documents already present in Catalog's official export**. It exported only Base `cr_token` JSON, leaving many Ethereum records dependent on rate-limited gateways.

## Recovered offline source coverage

The official `20260309_140200/public` snapshot contains:

| Source table | Network | Original documents |
| --- | --- | ---: |
| `cnft` | Ethereum | 1,279 |
| `media` | Ethereum, legacy Zora Media releases selected by Catalog's census | 1,220 |
| `cr_token` | Base | 1,611 |
| Total | | 4,110 |

All 2,499 Ethereum document identities match the snapshot's Ethereum `token` table by exact contract and decimal token ID. Export rejects identities absent from that census, duplicate identities and lossy numeric IDs. Original JSON and metadata URI are preserved, with source table, SHA-256 of source Parquet and snapshot date. No new gateway requests were necessary.

The **4,036 currently imported Catalog records all match a saved original document**: 2,489 Ethereum and 1,547 Base. This is complete metadata-document coverage for the current app selection, not proof that the whole platform or all later metadata versions have been recovered. The platform inventory previously contained 4,164 token references; 54 Base records lack raw metadata in this snapshot, and app deduplication/selection also changes the denominator. Snapshot metadata is historical evidence, not a fresh contract URI or playback check.

The supplement is `data/catalog/ethereum-original-metadata.json`. Its source is [Catalog's official data repository](https://github.com/catalogworks/catalog-squidward-data). It must be loaded alongside the existing Base `data/catalog/original-metadata.json` without running a second writer against `data/music-metadata.json`.

## BPM, key and credits

Across all saved documents matched to the 4,036 app records, the current extractor finds **zero nonempty structured BPM, musical-key or collaborator-credit fields**. The explicit `bpm` and `key` columns in `catalog_release_metadata.parquet` were also empty across all 3,565 rows, including testnet rows, in the inspected snapshot. This is a statement about this export and these documents; it is not a claim that Catalog never supported these fields.

The useful BPM/key evidence is in titles and artist-written release notes. The strict parser originally recognized 24 BPMs and five keys. Root's subsequent matched-square-bracket title fix adds `REAL CRIA [121.35 BPM] ft. Arylee`, producing **25 original BPMs and five keys** in this audit. These are supplied text values, not audio estimates.

There are more narrative clues requiring context-aware review:

- `Water Dungeon` explicitly describes itself at 150 BPM, but the current parser accepts only standalone BPM lines and marked titles.
- `910. Moonwalk` includes `BPM80`; `#921 - Nana - (Collab Edition #7)` includes `Amin, BPM135`.
- Dabow sample/songstarter notes contain filenames such as `Dabow_128bpm_Melody_Stack_Loop_Real_Dbm`, which need a dedicated, conservative parser before musical values are presented.
- `$ea$on$` says it starts at 75 BPM and ends at 150 BPM. A single unqualified BPM would discard this variation.
- `SHEESH! (JERSEY CLUB REMIX)` describes a genre range of 120–150 BPM; that is not a measured tempo of this recording.
- `I AM NOT YOUR FATHER` describes a vocal-stem pack at C# major and 152 BPM. Verify whether the note attributes those values to the released master before applying them to the song.
- Some Base descriptions discuss several tracks in an album. `Quick Like A Bank` repeats commentary about `Of All The Things`; album-wide prose must not become a per-track musical claim.

Credit-language discovery identifies **1,375 notes with candidate phrases** such as production, mixing, mastering or artwork. This is a review queue, not 1,375 verified collaborator relationships. Preserve roles, exact release identity and source quotations when converting prose into credits. Existing note rendering already preserves access to the prose.

## Other useful original fields

Matched app-record coverage using the current extractor:

| Field | Records |
| --- | ---: |
| Positive duration | 4,035 |
| Description / release notes | 3,533 |
| Track number | 2,445 |
| Record label | 463 |
| Nested `project.title` | 480 |

The extractor now shows `project.title` as Project without inheriting album description, credits or other tracks' properties. A regression test enforces that boundary.

## Reproduction and verification

From the repository root, with DuckDB available:

```sh
python scripts/catalog-metadata-export.py /path/to/squidward/20260309_140200/public
python3 tests/catalog-metadata-export.test.py
node scripts/catalog-metadata-audit.mjs
```

The exporter writes only the new Ethereum supplement. The audit writes only `data/catalog/catalog-metadata-audit.json`. It does not modify live enrichment or contact storage gateways. Five exporter tests pass: exact large-token identity and provenance preservation, unknown identity rejection, duplicate rejection, invalid/lossy identity rejection, and missing-document handling. No UI changes were made in this workstream.
