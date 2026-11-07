# Bounded Spinamp recovery gap pass

This pass starts from 169 unresolved processed-track references in the frozen 52,987-track inventory. It does not recrawl the platform or claim to enumerate every NFT edition.

## Faster exact relationship lookup

The original public GraphQL relation query repeatedly returned `canceling statement due to statement timeout`. Removing the total count or splitting relation and metadata reads produced intermittent successes but remained unreliable. Those failed attempts remain recorded in `representative-first-pass-2026-11-06.json` and `representative-nested-pass-2026-11-06.json`; they were not converted into empty results.

The working query filters **both `processedTrackId` and `nftId`**. The official [Spindexer bootstrap schema](https://github.com/spinamp/spindexer/blob/dfb0108b694c6dd826934283a08fd93892ab6983/src/db/migrations/01-bootstrap.ts) defines the relation table’s primary key as those two fields, with NFT ID first. This is consistent with the observed speed improvement; it does not prove the live database’s query plan or indexes.

A parsed token ID, or token 1 when the track identifier does not include a numeric token, is only a bounded **search candidate**. Ethereum’s two known identifier forms are tried separately. A candidate is accepted only when the API returns an explicit relation with the exact processed-track ID, exact NFT ID, matching nested NFT ID and usable metadata. A missing candidate is unresolved: it is not proof the track lacks NFTs. No chain, token, artist or media field is fabricated from the guess.

Candidate lookups cannot establish total editions. `relationCounts` is omitted for these tracks, and `representativeLookups` records `scope: exact-track-and-nft-relation` with `totalCount: null`. The importer still applies its normal chain, media, attribution, platform and duplicate checks. Provider failures and malformed responses preserve previous evidence and remain retryable.

`scripts/spinamp-retry-representatives.mjs` allows at most 169 selected tracks and 338 public requests, an exclusive writer lock, 15-second request deadlines, atomic checkpoints and a three-consecutive-provider-failure stop. No wallet transactions, private APIs or paid services are used.

## Collector expansion

The independent explicit Lens cohort added ten complete release snapshots: 791 indexed editions. Together with Pete Rango’s prior 16-edition snapshot, the file now covers eleven releases, 807 editions and 594 distinct positive-balance wallet addresses. This is a small, named cohort, not all 628 Lens recordings or complete platform ownership coverage. Underlying index freshness remains unknown.

See `docs/spinamp-collectors.md` and `data/spinamp/collector-expansion-2026-11-06.json` for per-release results and the separately bounded SOZI completion. Every saved relation and owner response is retained and revalidated against the exact original recording metadata pointer.

## Final frozen outcome

All 169 remaining references were attempted. **125 exact indexed track↔NFT links were recovered; 44 remain unresolved** because the bounded candidate NFT did not have the requested relation. They are not successful empty results and may have other editions that were not searched.

Of the 125 recovered references, 71 become new catalog recordings, 45 are already-covered duplicates, and nine fail existing eligibility rules: six lack indexed audio evidence, one is a Pods podcast, one has unsupported original storage, and one lacks usable original media. The new recordings comprise 54 Sound, 15 Zora and two anotherblock entries; 49 are on Base and 22 on Optimism. This is indexed metadata recovery, not fresh chain verification or a claim that all 71 were playback tested.

The Spinamp bundle grew from 27,449 to **27,520** recordings. All 27,449 previously shipped IDs were retained. The regenerated import audit accounts for the entire 52,987-track frozen inventory: 27,520 admitted, 7,803 duplicates, 17,620 excluded and 44 unresolved. Candidate outputs were generated under ignored `work/spinamp-gap-candidate` and checked before replacing the published data files. Exact source field identity was rechecked for all 125 recovered references.

`data/spinamp/gap-recovery-summary.json` records the counts and 71 new record IDs. `data/spinamp/representative-retry-2026-11-06.json` preserves every attempted track and its outcome. No retry or collector writer remains active after this checkpoint. Further recovery of the 44 requires a wider but still explicitly verified candidate search; it should not erase the unresolved status or silently substitute an unrelated token.

## Verification checkpoint

The integrated catalog loader reports **37,345 recordings**, including 27,520 Spinamp additions. All 34 focused resolver, importer, Nina and collector tests passed. An isolated canonical server on port 4297 returned the expected indexed counts for all eleven collector endpoints. Actual collector screens passed at 1440px dark and 390px light, with no page errors or horizontal overflow; both screenshots were visually inspected. This uses real local endpoints, not mocked ownership data. Evidence is in `data/spinamp/gap-collectors-ui-verification.json` and `captures/spinamp-expanded-collectors-*`.

The new 71 media entries were not individually playback tested in this pass, and remain labeled indexed rather than chain/playback verified. No source audio was transcoded or replaced.

## Portable evidence bundle

`data/spinamp/gap-reference-evidence.json` is a **414,659-byte tracked, derived snapshot** of all 125 recovered compact NFT references plus their `representativeLookup` identities, checked times, original metadata digests and reconstructed exact-match source queries. It also lists all 44 unresolved track IDs and reasons. A fresh checkout can audit this bounded cohort without the ignored full `nft-references.json.gz` cache.

This file is explicitly **not a raw GraphQL response archive**: raw network responses and original metadata bytes were not retained for the successful retry. Query text is reconstructed from the validated track/NFT identities using the resolver’s query builder. The metadata digest preserves the retrieval pipeline’s original-metadata digest; without those original bytes, the exported snapshot cannot independently recompute that digest or prove the upstream response cryptographically.

`scripts/spinamp-export-gap-evidence.mjs` regenerates the export from the local cache and tracked retry receipt, refusing identity/count/status mismatches. `tests/spinamp-gap-evidence.test.mjs` runs solely against tracked artifacts: it reconciles 125 recovered plus 44 unresolved outcomes, rejects tampering and verifies that all 71 newly admitted recordings retain the exported source metadata digest. All three packaging tests passed; admitted catalog data was unchanged by this export.
