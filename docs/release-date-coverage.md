# Dates for oldest/newest browsing

`data/release-dates.json` preserves historical creation dates from exact Catalog token rows and Sound's modern release-contract census. `scripts/export-release-dates.py` reproduces the data from Catalog's official March 9, 2026 Parquet snapshot and the checked-in Sound census. Neither recovery timestamps nor current read blocks are used as release dates.

The index includes 4,164 Catalog token identities and 9,316 modern Sound release-contract identities. On the current 9,203-record app selection, **8,675 records have a date**: all 4,036 Catalog records and 4,639 Sound records. The remaining 528 are unknown, including 276 legacy Sound records, 162 Mint Songs records and the other platforms. These counts are in `data/release-date-audit.json`.

Date meanings remain explicit:

- Catalog Ethereum uses `token.created_at_block_timestamp`; Base uses `cr_token.created_at_timestamp`. The label is **Token created**, not first purchase or original recording release.
- Modern Sound uses each factory event's release-contract `createdAt`. The label is **Release contract created**, which may precede the first mint or public release.
- Legacy artist-contract deployment dates are excluded because one artist contract can contain many songs released later.
- Artist-supplied Release date can be a fallback only if it has an unambiguous ISO date. The 44 current slash-formatted metadata dates are not guessed as US or international dates. Original recording release dates are not substituted for NFT creation dates.

`releaseDateForRecord(record, index)` returns the date, numeric sort timestamp, provenance kind, label and source. Attach this as `record.releaseDate`. `compareReleaseDates(a, b, "oldest" | "newest")` always puts unknown dates last and resolves ties deterministically by record ID. Four tests cover ambiguous/impossible dates, exact token/network identity, artist-contract exclusion, recovery timestamp exclusion, conflicts and sorting.
