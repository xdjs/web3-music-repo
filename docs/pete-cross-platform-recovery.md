# Pete Rango cross-platform follow-up

Checked November 6, 2026. This adds one verified media lead and three public wallet references, not a complete discography.

## rush: recoverable clip, not a full song

The [Zora rush page](https://zora.co/coin/base:0xc01f464c55f5b1bec05db5205d2fae9e6a835a5e) explicitly attributes the post to `p3t3rango`. Base contract `0xc01f464c55f5b1bec05db5205d2fae9e6a835a5e` returns `rush` from `name()` and `symbol()`, 18 decimals and a fungible supply from ERC-20 reads. Its `contractURI()` points to `ipfs://bafybeic6a5ersjfzxjguumablr4j5m2jvtrqcnzpzsfbytpw44ksoazobm`.

That original JSON contains an MP4 at `ipfs://bafybeiciis2v57i7o3rtfwnonh7mqldmsarc2jfbvtrcaji7beoreu7vqq`. The full 23,056,749-byte asset downloaded successfully through Zora's decentralized-content gateway. ffprobe reports **20.633333 seconds**, H.264 video (2160×3840), and AAC stereo audio at 44.1 kHz. It is an audiovisual promotional post; it must not be described as the complete recovered song. Audio presence and browser playback are verified: the integrated app reached currentTime > 1 second and readyState 4 with the original IPFS video. This remains a short clip, not a complete song.

No BPM, key, or structured collaborator fields were present in this metadata document. The descriptive narrative mentions a creative session with soothebyhendrix, but it is not a formal credit role and has not been turned into a structured collaborator association.

Evidence:
- `data/pete-recovery/rush-evidence.json`: fixed-block RPC requests/responses, decoded fields, source-page attribution, content hashes and ffprobe result.
- `data/pete-recovery/rush-metadata.json`: original token-associated metadata.
- `data/pete-recovery/rush-candidate.json`: proposed app record with `standard: ERC20`, `tokenId: null`, `mediaScope: clip`; deliberately not loaded automatically.

IPFS.io returned 429; the same CID succeeded through `magic.decentralized-content.com`. A failed gateway is not evidence that the content is lost.

## Public profile wallet expansion

The [Zora public profile](https://zora.co/@p3t3rango) server-rendered data lists:

| Address | Evidence |
| --- | --- |
| `0x625307de45bd25ad6bf6cc7391a308fc84067cf7` | Public wallet; page associates `p3t3rango.eth` |
| `0xf03afc656a7331f8756878b0fd027b831770ccc4` | Public linked wallet |
| `0x5f99e1f28bfd7cff25327fd6162fbfc7e7916b62` | Public linked wallet; matches rush's onchain payout recipient |

These are platform-reported associations, not independent signature verification or a reason to treat every held NFT as Pete's creation. They provide additional creator-discovery search inputs. Historical minted/created release enumeration remains pending for all three wallets.

## Required integration safeguards

Implemented reader safeguards: `readOwner` returns unsupported for ERC-20, with coin-specific wording and no network call. Unknown explicit standards are rejected. `readNFT` reads ERC-20 `contractURI()` at the captured block, requires `tokenId: null`, and preserves the video/clip scope and duration. It rejects invented coin IDs, unsupported standards and out-of-range NFT IDs. Earlier records without a standard retain their validated ERC-721 behavior (7,520 existing entries omit the standard); explicit unknown standards never default to ERC-721. Existing ERC-721/1155 and legacy Catalog tests continue to pass.

Remaining integration work: review holders/edition counts, explorer token links, wallet library identity, and any token ID assumptions before enabling coins. `readHolders` returns raw contract balances and must be bypassed for coins until a dedicated decimal-aware coin-holder view exists. The wallet library queries the indexer NFT endpoint with ERC-721/1155 filters; also exclude `standard: ERC20` when matching catalog candidates as a defensive boundary. A coin balance must never become an NFT quantity or a collected NFT edition. Show this release as a clip/video; do not add it to the full-song count or claim NFT collector coverage. Media downloading and playback may use the existing video controls once the storage allowlist and browser rendering are checked.

## Remaining leads

The previous ten explicitly attributed NFT records plus this explicitly labeled coin-backed clip appear in the app; eleven attributed media entries does not mean eleven full-song NFTs. A search excerpt from an old Fresh Mints thread mentions `don't care what they say`; no exact contract or original release was established in this bounded search, so it is not imported. Peachy Dreams still has only tracklist evidence in Ripple Effect 001. No Mint Songs release under Pete's aliases was verified by this task. Broader Zora creator enumeration, Lens publications, custom contracts and older linked-wallet histories remain open.

Reader validation: five Pete-specific tests plus existing NFT-reader/recovery tests pass (23 tests total). Tests cover exact `contractURI()` selector, fixed-block reads, nullable IDs, clip scope, no `ownerOf` network calls, invalid standards, and uint256 bounds.

## Playback resilience and rendered verification

Same-CID media fallback now tries the fixed Filebase, Pinata and Zora decentralized-content gateways, preserving CID/path/query. Metadata reads use the same finite fallback and reject redirects. Tests reject credentialed URLs, custom ports, foreign hosts and encoded traversal; no arbitrary media proxy was added. ERC-20 coins bypass both ownerOf and the NFT holder index.

Four selected real releases passed browser playback: rush (20.63s), Mint Songs Driving (214.09s), Sound Breakdown (180.68s), Catalog IOI (248.66s). Driving exercised a real Pinata-to-Filebase fallback. Rush and Driving pages were checked at 1440px and 390px in light/dark themes, with no page errors, horizontal overflow or broken main artwork. The app correctly shows rush as a VIDEO CLIP and a coin-holder limitation; Driving shows only its exact selected token owner with explicit partial scope. These checks are samples, not all-track validation. See `data/recovery-playback-verification.json`, `scripts/verify-recovery-playback.mjs`, and `captures/recovery-*.png`.
