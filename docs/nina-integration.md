# Nina listening integration candidate

Prepared 2026-11-06 on `codex/nina-and-queue`. This implementation follows the earlier read-only [readiness audit](nina-recovery-readiness.md). The importer has produced a review candidate; root owns copying it into the frozen application bundle, browser integration checks and deployment. This document is not a deployment receipt.

## Candidate and retained scope

`work/spinamp-nina-candidate/recovered-media.json` contains **27,449 Spinamp records: all 21,395 existing records plus 6,054 Nina records**. Assertions verified every existing ID, artist attribution, vendor artist identity, chain/contract/token identity, kind and selected media URI remains intact. The 6,054 Nina mint keys are unique and case-sensitive. Candidate size is **77,947,240 JSON bytes / 11,761,945 gzip bytes**; file SHA-256 is `4ac7b895ef935249898f44877d2abf277b6bb09c04e168a12bf817d6af777f55`. Summary and compressed audit are beside the candidate; no duplicate candidate belongs in the deployed `data` tree.

Nina's cached inventory remains 6,206: 6,204 linked mints and two empty relationships. **150 linked releases have no artist name in either the inventory or artist atlas**, so they remain excluded instead of guessing names from slugs, descriptions or combined titles. The candidate represents **1,711 artist IDs**, with **1,096 unknown indexed durations**. All 6,054 indexed MIME fields are empty. No full API or RPC scan was performed, and this is not a complete Nina-ever census.

## Identity and provenance

`src/solana-identity.mjs` checks that an address decodes to 32 bytes using base58 while preserving case. This validates address shape, not the existence or type of an onchain account. [Solana's account documentation](https://solana.com/docs/core/accounts/account-structure) describes this address encoding. Imported identities are `{chainId: "solana", mint, standard: "METAPLEX"}`; there is **no EVM contract or invented numeric token ID**. All imported processed-track IDs and Nina platform-internal IDs must agree with the exact linked mint. Other Solana platforms remain outside this importer scope.

The optional `ninaReleaseAddress` is parsed only from the exact preserved Nina public URL and remains separate from the mint. The source's date appears as `indexedSourceDate` with `kind: indexed-metadata-date`, not a claimed mint-block timestamp. Source profiles keep stable vendor IDs without name-only merges. Collector balances, Solana wallet holdings, royalties and current mint/metadata chain reads are not implemented by importing the listening records.

Unknown-duration records are admitted only when their exact linked Nina NFT metadata media matches the separately indexed processed-audio URL and passes the existing storage policy. The basis, missing MIME and unknown duration are explicit in `recovery.mediaEvidence`. Source status remains `indexed`, `onchainVerified: false` and `playbackVerified: false`; startup QA does not become a claim that the entire catalog plays. Actual audio/video kind stays provisional until decoded dimensions have been observed, with an audit reference for the checked samples.

## Bounded playback results

`data/spinamp/nina-playback-verification.json` contains six actual Chromium native-audio decode checks spanning both `nina.market` and `ninaprotocol.com` eras, two unknown-duration entries, and a 2024 entry. Four originals played: **Error Handling**, **loess**, **The Way You Get By**, and **Anna Lily & Maxim - Fearmore**. **Flying Blind** and **Hospital For Beasts One** did not start from their original Arweave references within 25 seconds; both then played through their separately indexed Spinamp IPFS audio copies. All six decoded audio and reported zero native video dimensions.

The importer selects those two proven preserved copies only when the exact record ID, Solana mint, original content reference, observed successful fallback and inventory fallback CID all match. It retains the original URI, sets `mediaSourceType: spinamp-preserved-audio`, `originalMediaMissing: false`, and `originalMediaUnavailableReason: original-startup-timeout`. No original URI is relabeled as verified available. A source timeout is not proof of permanent loss. The provenance UI must distinguish this from an unsupported storage host or an absent original URI.

Reproduce the bounded original checks with `node scripts/verify-nina-playback.mjs`; then retry only those failed samples through their explicit preserved copies with `node scripts/verify-nina-playback-fallback.mjs`. These scripts do not bulk-download the catalog or scan wallets. The receipt is reconciled against the final candidate's selected media.

## Validation and integration ownership

**26 focused tests passed** across Solana identity, Nina import, existing Spinamp import and resolver behavior. They cover case-sensitive identity and dedup, invalid/contradictory source mappings, EVM/coin compatibility, strict absence of fake token IDs, unknown-duration evidence, metadata versus mint dates, and exact-content fallback selection. Root owns loader/date-key integration; the frontend agent owns Solana provenance labels and guards that prevent EVM owner, collector, holder and NFT-RPC actions on Solana assets. Those browser/server checks must pass before deployment.

The 169 remaining non-Nina relation failures were not widened into another large scan; the parallel agent's bounded retry still reported SQL timeouts. The published record bundle is not regenerated automatically by that resolver. Future Nina name recovery should read exact original metadata for the 150 withheld entries and preserve attribution provenance rather than derive artist identities from text patterns.
