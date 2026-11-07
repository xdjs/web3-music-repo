# Second bounded recovery pass

The listening catalog stays at **37,345 recordings**, including **27,520 Spinamp additions**. No listening records were added or removed in this pass. The missing representative-link count falls from **44 to 42** after two exact links were recovered through NFT token 2. Ryan Todd’s “My Way” is already covered by `recovered-sound-10-a3e48f40cfff1d00c3d899570f54f6980fbe7910`; the other newly linked entry is a Pods podcast and remains outside music scope. The regenerated import audit/summary incorporates both outcomes. The listening bundle was not rewritten merely to refresh timestamps.

The reverse query reads exact NFT IDs for token 0, 1 and 2, then inspects each NFT’s explicit processed-track links. The run made 44 bounded public requests, with an exclusive writer lock, atomic checkpoints, a 15-second request deadline and a three-consecutive-provider/validation-error stop. Raw queries and GraphQL responses are retained in `data/spinamp/reverse-reference-audit-2026-11-07.json`; the two recovered compact references are also included in `data/spinamp/remaining-gaps-audit-2026-11-07.json`. Seven earlier discovery probes, including SQL timeouts, are retained separately in `data/spinamp/gap-discovery-probes-2026-11-07.json`.

Of the 42 still-unresolved entries, 39 returned no indexed NFT at the three probed IDs. Three had inspected NFTs linked to different processed tracks. **Neither outcome proves an unminted release or absence of other editions.** Some track hashes describe alternate indexed versions of an existing song; these are documented separately, never silently merged or assigned the other version’s NFT. Raw returned ownership or chain freshness is not inferred.

## Collector data added

A ten-release Lens cohort added **292 mapped ERC721 editions**. Totals are now **21 exact-release snapshots, 1,099 mapped editions and 757 distinct positive-balance wallet addresses**. Per-song wallet counts must not be summed and called unique people. All snapshots retain the unknown-index-freshness and not-independently-chain-verified labels.

| Artist       | Recording                                         | Editions | Indexed wallets |
| ------------ | ------------------------------------------------- | -------: | --------------: |
| Bob Peace    | Love You II                                       |        1 |               1 |
| dragaan.lens | idontwannacrynomore                               |        1 |               1 |
| alarke.eth   | Alarke - Little Secret [Live at 343 Labs]         |       19 |              18 |
| valentina cy | Little Tunny                                      |       16 |               6 |
| valentina cy | Mais uma Vez                                      |       26 |              19 |
| Heno.        | Day 28                                            |       29 |              29 |
| Heno.        | Day 1                                             |        3 |               3 |
| Heno.        | Day 27                                            |       33 |              31 |
| alarke.eth   | Producing music with NFT stems in an arcade setup |      139 |             126 |
| alarke.eth   | Future Self (El Monk Remix)                       |       25 |              24 |

The collector cohort used 44 public requests and no incomplete snapshots were promoted. Immutable Arweave transaction metadata references are now supported alongside IPFS. Every relation and owner response must still carry the **identical original metadata URI**, exact track, chain, contract and token identities. Mutable or arbitrary HTTP metadata hosts are rejected. No generic URL fetching or collector attribution by shared contract was introduced. All raw evidence is retained in `data/spinamp/collector-snapshots.json`; the new cohort receipt is `data/spinamp/collector-expansion-pass2-2026-11-07.json`.

## Broader Sound leads

The root Sound reconciliation identified a separate subset of **62 formerly unresolved modern contracts** without matching indexed media. There is **zero exact chain/contract overlap** with this pass’s original 44 Spinamp gaps. Nineteen of those 62 appear in the frozen Spinamp inventory: 15 attribution conflicts, two lacking indexed audio evidence, and two lacking indexed NFTs. The other **43 contracts are preserved as concrete outside-inventory leads** in `data/spinamp/remaining-gaps-audit-2026-11-07.json`.

The 15 attribution holds often involve a publisher/profile versus a performer credited in metadata. Those holds remain intact: this pass did not merge people by names or replace the minting profile with an assumed performer identity. The 62-contract subset is not the whole Sound platform, nor proof of complete factory history. Source: `data/sound-resolution/catalog-reconciliation.json`.

## Validation

Sixteen focused reverse-query, collector and prior-evidence regression tests passed, including replay of all 44 tracked raw responses and identity validation of every stored snapshot. All 27,520 previous Spinamp IDs were retained when comparing the generated candidate. No retry or collector writer is left running. The isolated local UI check uses the actual collector API with Arweave-backed releases at desktop dark and mobile light; see `data/spinamp/pass2-collectors-ui-verification.json` and `captures/spinamp-pass2-collectors-*`.
