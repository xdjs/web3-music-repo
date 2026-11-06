# Collector recovery correction — November 6, 2026

The reported **Say it celly** recording is ERC-721, not ERC-1155. Its song page previously used `ownerOf(3)` because only verified Sound deployment contracts were eligible for release-wide collectors. That showed one selected edition owner, or an error if the RPC was unavailable, despite other editions of the same recording existing.

The new ERC-721 path reads a bounded page of indexed NFT instances and includes an owner only when that token's original media content address matches the recording's original IPFS/Arweave media. Matching artwork, titles or contract membership is insufficient. Editions are grouped by wallet with exact token IDs. A missing or failed index can fall back to the selected token owner; pagination errors remain retryable. Processed Spinamp audio is never substituted for original media when establishing edition identity.

ERC-1155 recordings separately use Blockscout's token-instance holder endpoint, including the exact token ID in the path. They never use contract-wide balances or `ownerOf`. Response validation rejects wrong token IDs, malformed balances and unsafe/repeated cursors while preserving uint256 precision. Catalog historical snapshots and existing Sound/legacy paths retain their scope. Collector identity and PFP enrichment reuse the established historical Sound/ENS pipeline.

## Verification

- Say it celly: indexed tokens 1–7 share the exact original audio CID; seven distinct wallets returned. Direct Ethereum `ownerOf(3)` at block **26,357,376** independently matches Pete's indexed address.
- ROUND N ROUND: the Optimism ERC-1155 token 2 endpoint returns five wallets. A direct `balanceOf(address, 2)` at block **159,194,100** independently matches the first indexed holder's balance. The canonical server endpoint also returns scope `token-edition` and five wallets.
- Real Say it celly page at local port 4191 displays seven collectors and three recovered profile images. Actual 1440/390px light/dark screenshots were inspected; no overflow or JavaScript errors. Other wallets retain honest placeholders.
- Fifteen focused holder/legacy/Catalog tests pass, including cross-token exclusion, same-media filtering, large balances, hostile cursors and failure/empty distinctions.
- Separate Base and Zora ERC-1155 samples returned unavailable providers; these remain retryable, not empty-holder claims. One other Optimism sample returned an indexed empty page. No complete holder census is claimed.

Evidence: `data/collector-live-verification.json`, `data/collector-ui-verification.json`, `captures/collectors-recovered-*.png`, `tests/recovery-holders.test.mjs`, `scripts/verify-collector-recovery.mjs`.

## Other affected recordings

The static audit of the currently loaded **13,640** recordings finds **1,967** eligible for the newly available media-matched ERC-721 route and **2,076** for exact-token ERC-1155 holder lookup. These are routing eligibility counts, not successful live lookups for every recording.

ERC-721 eligibility includes Sound Base (1,744), Sound Ethereum (16), Mint Songs (142), Songcamp (43), Zora Ethereum (6), and other/unconfirmed collections (16). ERC-1155 eligibility includes Catalog Base records lacking usable historical holder entries (1,434), Supercollector Optimism (616), Zora Base (8), and Zora Network (18).

Existing verified Sound release paths (5,017), legacy Sound paths (276), and Catalog historical snapshots (2,602) remain in place. Another 1,701 records still have only a selected-token-owner path; a content coin remains outside NFT collector views. See `data/collector-coverage-audit.json` for every affected recording and platform/chain grouping. Re-run `node scripts/audit-collector-coverage.mjs` after promoting the larger Spinamp candidate.

This change is implemented and locally verified; production deployment is owned by the release orchestrator. Do not describe the fix as live until the deployed endpoint/page has been checked.

Primary endpoint reference: [Blockscout token API documentation](https://github.com/blockscout/agent-skills/blob/main/blockscout-analysis/references/blockscout-api/tokens.md).
