# Source metadata enrichment checkpoint

The current 37,345-record catalog was audited against baseline `af439241866f0d86d747715af2ab6308ef1b61c2`. This pass keeps the catalog cohort unchanged. Source facts and Open BPM estimates remain separate.

| Metric | Before | After | Gain |
|---|---:|---:|---:|
| Tracks with source-supplied BPM displayed | 7,950 | 7,955 | 5 |
| Tracks with source-supplied key displayed | 7,524 | 7,525 | 1 |
| Structured BPM metadata | 7,922 | 7,950 | 28 |
| Structured key metadata | 7,519 | 7,525 | 6 |
| Tracks with source credits/collaborators | 486 | 594 | 108 |
| Tracks with lyrics | 1,321 | 1,329 | 8 |
| Tracks with genres | 15,701 | 15,701 | 0 |

The structured gains include facts already displayed from release notes, so they must not be advertised as 28 newly discovered tempos. Explicit standalone BPM/key lines in preserved descriptions supply the five newly visible tempos and one key. No prose numbers, marketing claims or model guesses were treated as musical facts.

The bounded public-index pass read 300 exact NFT metadata documents across platforms, with zero failed reads. It improved 120 records: 108 TokenTraxx releases with named role maps, eight Sound lyrics, and four recordings with explicit musical layer traits. Recording studios remain source credit strings, not newly invented artist identities. Collection-wide collaborators and royalty addresses were not copied into musician credits. The omgkirby sample description promises BPM/key, but its actual token traits contain musical layers; missing musical values were not inferred.

A separate Open BPM pass processed ten Nina recordings missing supplied tempo, using one download worker and at most two analysis threads. Nine yielded estimates and one was below the confidence threshold and remains `needs-review`. Normal BPM display identifies estimates with `~`; keys remain supplied metadata only. Source media, byte hashes, durations and confidence are in `data/metadata-enrichment-summary.json` and `data/audio-analysis.json`. No listening copies were generated. These are algorithmic estimates, not an audition or tempo-accuracy guarantee.

## Evidence and reproducibility

- `data/metadata-enrichment-summary.json`: baseline/current/delta, per-record analysis evidence, revenue limits.
- `data/metadata-enrichment-audit.json`: exact 300 NFT identities, source URIs, checked dates, metadata SHA-256, added fields. Its final pass re-extracted the already fetched documents from cache; it did not issue 300 duplicate network reads.
- `data/metadata-enrichment-sources.json.gz`: portable original indexed metadata bytes for those 300 documents. Hashes are verified in tests. Public musical metadata only; no private profile mirror.
- `data/metadata-enrichment-identities.json.gz`: 27,520 current imported track-to-NFT identities preserved from the previously recovered public index. This makes the next bounded pass work without ignored development caches. These are indexed links, not new chain verification.
- `data/metadata-enrichment-checkpoint.json`: successful reads, schema version and exact NFT IDs, including documents that added no facts. Failures remain retryable; later passes skip completed identities. `--refresh` explicitly rereads them; `--cache-only` avoids networking.
- `data/metadata-notes-enrichment.json`: full-cohort offline explicit-note extraction, original versus index provenance retained.
- `data/enrichment-report.json`: refreshed current-cohort aggregate, replacing the stale 31,220-record report.

Next bounded pass:

```sh
node scripts/recover-indexed-music-metadata.mjs --plan --limit=300
node scripts/recover-indexed-music-metadata.mjs --limit=300
node scripts/recover-supplied-metadata-notes.mjs
node scripts/report-enrichment.mjs
```

The indexed worker makes one request at a time, at most 20 exact NFT reads per request, with 500 ms spacing and a 25-second request timeout. It never changes imported record identity or declares source metadata verified onchain. Original-cache recovery is Solana-safe and can be run offline with `--cache-only --cache-dir=<existing raw cache directory>`. It merges facts instead of dropping earlier facts. Reparse checkpoints do not churn unchanged record timestamps.

For a small additional BPM pass, `node scripts/analyze-missing-bpm.mjs --platform=Nina --limit=10 --concurrency=1 --download-timeout-ms=20000` skips existing attempts and records with supplied tempo. Failed downloads need explicit `--retry`. The pass stores full media analysis separately from supplied metadata and does not infer keys. No workers remain active at this checkpoint.

## Revenue boundaries

No new revenue events were recovered in this pass. Existing evidence remains 186 receipt-verified Base purchases across 113 releases, plus 144 Ethereum royalty events across 135 releases. These are historical subsets, not lifetime/all-platform totals. Gross sales are not artist income; split-contract payouts do not establish personal take-home pay. New revenue coverage needs additional platform-specific event and payment-allocation verification, not index prices.

## Validation

Fourteen focused tests cover exact portable source hashes, indexed provenance, next-pass checkpoint advancement, Solana-safe identities, additive/conflicting facts, source role maps, placeholder lyrics and strict note extraction. Actual local song Details rendered the new named credits, the source BPM on a Nina track, and a separately labelled Open BPM estimate at 1440 dark and 390 light: six cases in `data/metadata-ui-verification.json`, with distinct `captures/metadata-*.png`. Screens were visually reviewed; remote artwork was still pending in some captures, so these receipts do not establish cover-image or media-playback completeness. No UI or loader changes were needed.
