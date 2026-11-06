# Sound resolution audit — November 6, 2026

This audit adds one recovered archived-page audio reference and diagnoses a 15-contract sample. It does not complete Sound recovery or enumerate every compatible factory on every chain.

## What the previous counts meant

The existing recorded factory census contains **9,488 contracts**: **172 legacy artist contracts** and **9,316 modern release contracts**. These are different units and are not 9,488 distinct songs. The modern pass plus its minted-token fallback classified **4,699 as metadata-readable**, **3,361 as zero totalMinted at the recorded block**, and **1,256 as unresolved**. Legacy release expansion is separate. The census endpoints are snapshot blocks, not a permanent claim of current completeness.

Earlier failure records collapsed errors into “last minted token metadata unavailable.” This audit separates the contract call from metadata storage, missing media fields, and the unminted state. It does not overwrite the running workers or those original checkpoints.

## Fifteen-contract bounded sample

`sample-input.json` selects six unresolved Ethereum contracts and six unresolved Optimism contracts spaced across the preserved ordered lists, plus three previously unminted controls. It is deliberately sampled, not randomized or statistically representative.

Current reads of `totalMinted`, `totalSupply` and up to four representative `tokenURI` calls produced:

| Result | Contracts | Meaning |
| --- | ---: | --- |
| Readable JSON, no supported audio reference | 6 | Both `animation_url` and `losslessAudio` were explicitly empty in the successful documents. Titles, artists, artwork, durations, genres and descriptions can still survive. |
| Storage unavailable | 5 | Token URIs were readable, but tested Arweave requests encountered 404 and/or 429. No permanent-loss conclusion. |
| Token URI unavailable | 1 | `totalMinted = 577`, `totalSupply = 477`; token IDs 1, 577, 2 and 288 reverted. This is not an unminted contract and not proof every existing token is unreadable. |
| Unminted controls | 3 | `totalMinted = 0` at the new fixed block. No nonexistent token was manufactured. |

The six metadata-only releases are Calven J — Clutchman [Prod. By Flip-Trill]; 4KR4H — NewTech; Krazy Kimberlin — No Rugs; Pack Records — Blood Cultures - “Information”; Dabow — EMERGENCY; Mija — Groove (Jacob Grosse Remix). An empty field in these observed documents is distinct from an unreadable document. It is not a platform-wide absence claim.

Raw RPC return values, call errors, decoded metadata, redirect destinations, HTTP outcomes, selected token IDs and fixed blocks are saved in `data/sound-resolution/sample-results.json`. Later failures cannot override an earlier successfully decoded document when assigning the most informative status. The unminted test uses `totalMinted`, not current totalSupply (all minted tokens could have burned).

## One actual audio recovery: Mija / Jacob Grosse

The [May 20, 2024 archived official release page](https://web.archive.org/web/20240520194441/https://www.sound.xyz/mija/groove-jacob-grosse-remix) identifies **chain 10**, contract `0x1bfc0624b52e870cc00d4e39995c75c7da8763d3`, title and track ID. Its audio URL includes that exact track ID and still serves a Sound CDN transcode.

The complete fetched asset is **7,007,837 bytes**, AAC stereo / 44.1 kHz, **266.552993 seconds**. A real browser audio element played beyond one second at readyState 4 without an error. The integrated app also passed playback, explicit remixer-credit visibility, and archived-CDN provenance checks after import. See `data/sound-resolution/mija-app-verification.json` and `captures/mija-archived-provenance.png`.

- `archived-recovery.json`: normal `{records,evidence}` import bundle with one recording, indexed status, explicit `mediaSourceType: archived-sound-cdn`, and `chainMetadataHasMedia: false`.
- `mija-wayback-evidence.json`: capture/source identity, SHA-256 hashes, track/contract/chain matching, ffprobe result and browser playback evidence.
- The page retains Jacob Grosse as REMIXER and Mija as ARTIST, plus historical 50/50 credit allocations. Those percentages are not verified current payout routing or artist earnings.

This is **archived Sound CDN recovery linked to an exact onchain release**, not recovery of an audio URI from the current onchain-linked JSON. Preserve that distinction in the provenance tab and do not label the CDN transcode as an original lossless master. The original release's decoded metadata remains evidence even though its audio fields are empty. Two additional bounded Wayback queries for Dabow and Pack Records returned no captures for the exact URL; that is not proof no captures exist under other URLs/dates.

## Which chains are established as official Sound deployments?

Primary sources checked:

- [Sound protocol README, commit cd04022e](https://github.com/soundxyz/sound-protocol/blob/cd04022e178d071c3e86d201106335bc960161c4/README.md) explicitly lists Ethereum mainnet, Optimism, and test networks. It also provides deterministic deployment instructions for other EVM chains.
- [Sound SDK schema, commit 0ffa67f9](https://github.com/soundxyz/sdk/blob/0ffa67f95fc9eca2fe8ef93831804ce6b3c1af83/schema.graphql) identifies mainnet and Optimism, plus testnets, in its platform chain enum.
- Existing `data/census/crosschain-verification.json` records matching SoundCreatorV2 bytecode on Base and Polygon after excluding the compiler-declared immutable ranges.

**No official Base/Polygon platform deployment was established by these primary sources.** This is not proof none ever existed. Matching bytecode at the deterministic address supports “Sound-protocol-compatible factory,” not “every edition was listed by sound.xyz.” Preserve the user's multi-chain scope, but separate official platform listing evidence from permissionless protocol deployment.

## Why Base/Polygon historical scans were limited

Each existing Base and Polygon checkpoint contains **1,225 unavailable ranges**, zero completed ranges, and no recovered collections. Both remain incomplete. These are failed attempts, not successful zero-event scans.

Fresh bounded provider checks are saved as `rpc-*.json`:

- PublicNode explicitly says historical requests require a personal archive-access token.
- Base's public `mainnet.base.org` endpoint returned request-limit errors.
- dRPC accepted **single-request ranges of 1, 10 and 100 blocks on Base**, and 1 and 100 blocks on Polygon, at the recorded deployment-era heights.
- dRPC rejected the tested **500, 999 and 1,000-block Base windows** with a misleading message referring to “over 10000 blocks.” The previous scanner used 9,990-block windows. A batched probe also received that restriction for a one-block subrequest, so do not batch these historical requests.

A practical retry can use sequential **100-block** requests with checkpoints and backoff. This fixes the tested access pattern, but scanning roughly 46 million blocks per chain this way is expensive; a validated archive-capable provider or historical index is preferable for a full census. No key was requested, purchased or exposed, and no full scan was launched. Empty responses in the successful tiny windows establish only those exact windows.

## Reproduce safely

From the canonical repository:

```sh
node scripts/sound-resolution-select-sample.mjs
node scripts/sound-resolution-sample.mjs --limit=15
# Deliberately revisit prior failures only when needed:
node scripts/sound-resolution-sample.mjs --limit=15 --refresh
node scripts/sound-resolution-probe-rpc.mjs --chain=8453 --from=7272930 --to=7273029 --provider=drpc
node scripts/sound-resolution-probe-rpc.mjs --chain=137 --from=51327653 --to=51327752 --provider=drpc
node --test tests/sound-resolution.test.mjs
```

The sample reader writes only `data/sound-resolution`, validates known storage hosts and redirects, bounds metadata at 1 MiB, persists each contract, and resumes without redoing prior samples unless `--refresh` is supplied. The provider probe caps a requested window at 1,000 blocks, skips previously successful provider/window reads, and stores actual errors separately from empty log arrays. It is a capability probe, not a complete scanner.

Three tests cover stage classification, unminted versus burned supply, provider error preservation, and exact chain/contract/track matching for archived media. All passed. Do not overwrite the existing Sound expansion or active musical metadata/BPM worker files with these sample results.
