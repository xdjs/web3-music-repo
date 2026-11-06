# Catalog Ethereum royalty recovery — snapshot candidate audit

All 144 exact Catalog royalty candidates in the inspected snapshot have been verified from Ethereum transaction receipts, spanning 136 token identities. Of these, 143 payment events match 135 currently imported app records; token `0x0bc2a24ce568dad89691116d5b34deb6c203f342:610` is outside the current app selection. They are **royalty-recipient payouts**, not a complete sales history, net artist income, or artist personal earnings. No UI revenue totals were added.

## Discovery and precision

Catalog's [official snapshot](https://github.com/catalogworks/catalog-squidward-data), dated March 9, 2026, has 6,128 `royalty_payout_event` rows. Exact contract/token matching against its Ethereum token census yields 144 Catalog candidates. One unsafe numeric token identity elsewhere in the source table is rejected. The initial twenty-event cohort was expanded to all 144 exact Catalog candidates. All 144 receipts passed validation, with no unresolved candidates in this source table. This does not establish complete Ethereum sales or royalty coverage beyond the inspected snapshot and table.

The Parquet monetary columns are floating point. The exporter deliberately omits **every monetary value**, even ones that appear integral. Token IDs and block numbers must be safe exact integers before conversion. Payout and sale amounts come exclusively from ABI-decoded receipt data as BigInt, serialized as decimal strings.

## Contract and evidence verification

The supported module is Zora Asks V1.1 at `0x6170b3c3a54c3d8c854934cbc314ed479b2b29a3`, listed in the [official mainnet deployment file](https://github.com/ourzora/v3/blob/963da6e97e940ced0f4eb1a3062840a39eae232f/addresses/1.json).

A material source-version difference was discovered: the current GitHub `FeePayoutSupportV1` source declares an unindexed royalty recipient, while the deployed module's event indexes that recipient. The verifier uses the ABI in [the deployment's verified source](https://eth.blockscout.com/address/0x6170B3C3A54C3d8c854934cBC314eD479b2B29A3?tab=contract), preserved locally. Its runtime bytecode matches `eth_getCode` from Ethereum; Keccak-256 is `0xd0bcedfa5b7397642949ee6330bb41cd4519a24200227d80a2bcaff0c550883d`. The pinned current repository supplies the deployment address; the deployed verified source supplies the actual ABI and payout behavior.

For each candidate the verifier requires:

- Ethereum RPC chain ID `0x1`, successful receipt, exact transaction and block.
- Consistent log transaction/block hashes, no removed logs or duplicate log indices.
- Exactly one supported `AskFilled` event from the allowlisted module, matching the exact NFT.
- Matching `RoyaltyPayout` from that module for the candidate recipient, before the sale event, with a positive amount and total royalties no greater than gross sale amount.
- Exactly one matching NFT transfer from the sale's seller to buyer.
- An understood currency; WETH additionally requires the exact transfer from the module to the royalty recipient. Other ERC-20 currencies remain unresolved.

Of the 144 observed sales, 142 use native ETH and two use WETH as the ask currency. The two WETH royalties have matching ERC-20 transfer events. The deployed payout code attempts native ETH and wraps to WETH if the recipient cannot accept ETH. The ledger therefore labels these as successful royalty payout events with **ETH or contract-permitted WETH fallback**, rather than pretending receipt logs alone are a native ETH transfer trace. Successful `RoyaltyPayout` occurs after the transfer handler; failed payout attempts revert their logs. Zero-value and zero-recipient no-op cases are rejected.

The receipt-backed royalty recipient may be an artist, splitter, collaborator or another configured address. It is not automatically attributed to an artist's personal income. Gross sale amount is retained as sale context and must not be added to the royalty amount as if both were artist earnings. Dates in the candidate file come from the historical snapshot; block identity is independently matched, but block-header timestamps were not separately retrieved.

## Files and reproduction

- `scripts/catalog-ethereum-export.py`: read-only DuckDB export of discovery identities.
- `scripts/catalog-ethereum-fetch.mjs`: bounded read-only fetch, up to the 144 known source candidates, cached receipts, explicit retryable failures and network check.
- `src/catalog-ethereum-revenue.mjs`: strict receipt verifier.
- `scripts/catalog-ethereum-verify.mjs`: reproducible offline cohort audit.
- `data/catalog/ethereum-revenue-candidates.json`: 144 discovery candidates, no monetary floats.
- `data/catalog/ethereum-revenue-evidence/`: 144 receipts, verified deployed source/ABI and RPC provenance.
- `data/catalog/ethereum-revenue-audit.json`: 144 validated entries and an empty unresolved list.

```sh
python scripts/catalog-ethereum-export.py /path/to/squidward/20260309_140200/public
node scripts/catalog-ethereum-fetch.mjs --limit=144
node scripts/catalog-ethereum-verify.mjs --limit=144
node --test tests/catalog-ethereum-revenue.test.mjs
```

Seven tests pass, including exact-wei recovery despite poisoned floating input, chain/receipt/token/recipient/emitter rejection, removed/foreign/duplicate logs, ambiguous sales, excess royalties, missing NFT transfer, unsupported currency, uncorroborated WETH and replay of all 144 actual receipts.

## Remaining work

The 144 candidates in this source table are complete. Additional discovery must use the appropriate verified ABI for each official emitter. Ethereum auction proceeds, primary sale receipts, protocol fees, seller payments, royalties outside these events, album allocation, third-party marketplaces and other currencies remain outside this cohort. Current artist wallet or payout configuration cannot establish historical income allocation. No transactions, production writes, commits or UI changes were made in this workstream.

An exact example is simulacra’s `Harmless Thrash` (Ethereum Catalog token 986): the receipt records gross sale context of `100000000000000000` wei (0.1 ETH) and a royalty-recipient payout of `10000000000000000` wei (0.01 ETH), at transaction `0x6811fcbae5ed6a2c03a1240e14efac9f8b30e720dfd517519b65f93ff035df1e`. These amounts must not be added together as artist income.
