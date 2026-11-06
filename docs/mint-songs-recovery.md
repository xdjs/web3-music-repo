# Mint Songs recovery — November 6, 2026

Mint Songs did support structured musical metadata. This first preserved Ethereum cohort has empty BPM and key fields, but it retains credits, audio, artwork, titles, artists, descriptions and many durations. That is a statement about this cohort, not every Mint Songs release.

## Recovered Ethereum V2 cohort

`data/mint-songs/archived-media.json` supplies 143 unique token records from 117 artist labels. The preserved source contains 155 rows, including 12 redundant copies of token 142. The importer rejects conflicting duplicates and matches every metadata URI to its corresponding preserved ABI-encoded tokenURI call result.

- Original BPM: 0 / 143; original key: 0 / 143.
- Explicit structured creator credits: 143 / 143. These are creator credits, not 143 separate collaborator discoveries.
- Positive durations: 128 / 143.
- Original audio and artwork IPFS references: 143 / 143.
- Preserved schema also includes genre, license, ISRC, project, publisher and lyrics slots, but their presence as keys does not mean values were supplied.
- No Pete Rango / p3t3rango textual match in these 143 original documents. This does not rule out Polygon, later V2 releases or other attribution.

Source: [Neume's original extraction pinned to commit 6251e361](https://github.com/neume-network/data/blob/6251e3611e3c64277ed7cb4076a242130ea729de/results/mintsongs-get-tokenuri-extraction), plus [the corresponding tokenURI call results](https://github.com/neume-network/data/blob/6251e3611e3c64277ed7cb4076a242130ea729de/results/mintsongs-call-tokenuri-extraction). Original documents and chain call bytes are retained in `original-metadata.json`; source download SHA-256 is pinned by the importer. Do not use the old Neume transformation's hard-coded owner field: no ownership is inferred here.

The Ethereum contract is `0x2b5426a5b98a3e366230eba9f95a24f09ae4a584`. A current onchain `name()` call returned `MintSongsV2`. Current tokenURI and original IPFS JSON matched the preserved snapshot for tokens 1, 2 and 3 at block 26,354,578; token 7 also matched in a separate latest-block read. Token 7's audio returned HTTP 200, `audio/wav`, 56,648,124 bytes. Header success is not an audition or browser playback test. All bundle records therefore retain **indexed** status; live checks are stored separately in `live-verification.json`.

Neume's [later V2 crawler](https://github.com/neume-network/crawler/blob/main/src/strategies/mintsongs_v2.ts) documents a burned token 113 and token 13's trailing-space URI. The recovery keeps historical music references even when current ownership may be absent. The importer normalizes surrounding URI whitespace; it does not fabricate current owners or silently count failed reads as missing metadata. The later crawler is also a lead for mint census work; its cited last-mint receipt returned null in this session, so no complete-contract claim is made.

## Polygon Factory discovery

The shared Polygon song contract is `0xc29cbe04ae322469dc077741afa2fbccda748ae4`, discovered in a [preserved Polygon token list](https://github.com/daoleno/bbox/blob/master/lib/tokensNFT.js) and checked directly using chain ID 137, `name()` = `MintSongs721`, and `tokenURI()` results. This is distinct from poster contracts and the Editions fork.

Eight deliberately spaced token samples were read at Polygon block **96,831,910**. See `polygon-discovery.json` for exact request/response bytes and decoded documents:

- Token 100 is test content, excluded from listening import.
- Tokens 20,000, 40,000, 60,000 and 80,000 returned valid **onchain base64 JSON** with song title, artist, edition number/count and song number, plus offchain IPFS media references.
- Token 1,000 returned JSON with an unescaped control character. Tokens 5,000 and 10,000 returned malformed JSON with delimiter errors. These remain unresolved; their errors and original bytes are preserved. No automatic quote-repair guess was used.
- Token 60,000 is *SHUT IT OFF* by TAY; the referenced audio returned HTTP 200, `audio/wav`, 52,003,914 bytes. Playback is not yet verified.
- None of the successfully decoded sample documents contains BPM or musical key. No platform-wide absence is inferred.

### Bounded expansion and imported Polygon songs

A further 30 selected tokens were read across the minted range, including the last token and adjacent editions of two known songs. There are now **38 sampled tokens**: 24 valid onchain JSON documents, including two test tokens; 14 malformed documents remain unresolved. All 22 non-test decoded token references returned successful audio HTTP headers. Grouping by original song number and exact audio CID reduces these 22 editions to **20 songs**. These are now appended to `archived-media.json` (163 total Mint Songs records before application-level deduplication).

The new songs include AbJo's *Agate!*, Dyl's *Flash Drive*, TAY's *SHUT IT OFF*, and Sushegaad Music's *Journey*. Original `Song Number`, edition number/count, representative token ID and every observed matching edition ID are retained. No current owners, mint payments or unobserved editions are inferred from these attributes. All 20 imported songs have original onchain metadata and verified audio headers; browser playback remains a separate check.

`totalSupply()` returned **85,340** and token 85,340 decoded successfully. The preserved implementation's `totalSupply()` returns a minted token counter; this is neither 85,340 distinct songs nor a current unburned-holder census. A broad token-mint log query targeting Pete's confirmed creator wallet returned HTTP 403. No wallet absence conclusion is drawn. No Pete Rango / p3t3rango textual match appeared in the successfully decoded samples.

Next: run the resumable bounded scanner, preserve failures, distinguish songs from editions and repair malformed metadata only with explicit, testable rules. `scripts/recover-mint-songs-polygon.mjs --scan --limit=30 --concurrency=2` examines a bounded sequential range and persists its cursor. `--tokens=1000,5000 --retry` revisits explicit failed IDs. A lock prevents duplicate writers. Do not launch a long scan without coordinating the orchestration worker. Contract implementation addresses found in verified-source mirrors are not automatically additional live collections.

## Reproduce and integrate

Download the two pinned Neume files above, then run:

```sh
node scripts/import-mint-songs.mjs /path/to/metadata.jsonl /path/to/calls.jsonl
node scripts/verify-mint-songs.mjs --limit=3
node --test tests/mint-songs.test.mjs
```

The verifier is resumable, skips prior successful checks, bounds each request, pins each run's Ethereum block, compares current tokenURI and JSON to the snapshot, and retains unresolved failures. `--refresh` deliberately revisits successes. It writes only `data/mint-songs/live-verification.json`, never the main metadata/BPM worker outputs.

`archived-media.json` uses the existing `{records,evidence}` bundle interface. Its embedded `record.musicMetadata` contains the existing flattened `bpms`, `keys`, `credits`, `details` fields with original metadata links. Evidence includes both URIs and gateway URLs, indexed status and Neume source attribution. Add it through the normal catalog merge and mtime signature. The importer automatically appends verified Polygon samples from `polygon-discovery.json`, making both chains reproducible. Main metadata workers may reuse `original-metadata.json[id].results` as an offline source, avoiding unnecessary gateway reads. Metadata verification does not upgrade playback status automatically.

Six focused unit tests cover duplicate handling, chain/URI mismatch rejection, explicit credits, unknown tempo/key, provenance status, URI whitespace, Polygon edition grouping, malformed JSON and test/non-audio exclusion. All passed. No shared UI or catalog loader was edited by the Mint Songs worker; orchestration handles integration and browser checks.
