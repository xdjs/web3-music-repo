# Indexed source metadata campaign

This campaign expands the previous 300-document sample across the 27,520 imported Spinamp track identities. It reads each record's exact known NFT ID through `nftById`, never searches or merges by title/artist name, and never changes recording IDs or media. Source fields are attributed to the public Spinamp index, not independently verified onchain. This is a cohort reread, not a complete music-NFT census. Open BPM analysis is a separate writer and evidence source.

The first additional 1,000 documents completed in 34.8 seconds with no errors; 135 supplied inline lyrics absent from the baseline. No supplied BPM, keys or credits were added in that first batch. Subsequent progress is recorded in `data/indexed-metadata-campaign-status.json`; final cumulative facts are summarized by `scripts/report-indexed-metadata-campaign.mjs` into `data/indexed-metadata-campaign-summary.json`. During a running batch, the durable checkpoint can be ahead of completed batch receipts.

## Completed result — 2026-11-07 UTC

The campaign completed at 01:20:56 UTC, with **27,520 successful record links to 27,520 distinct NFT documents**, zero failures, and both writer locks released. The catalog remains 37,345 recordings. This pass checked the remaining 27,220 after the original 300-record sample; it enriched **6,401** records.

| Added in this campaign       | Record count |
| ---------------------------- | -----------: |
| Inline lyrics                |          773 |
| Drum layer traits            |        5,628 |
| Chord layer traits           |        5,548 |
| Effects layer traits         |        5,548 |
| Lead layer traits            |        5,548 |
| Vocal layer traits           |        5,549 |
| Instrument detail            |            1 |
| Supplied BPM / key / credits |    0 / 0 / 0 |

These columns overlap and must not be summed as distinct recordings. Most layer traits are explicit omgkirby attributes; drum traits also occur in spottiewifi.io metadata. The complete cumulative receipt includes the prior 108 TokenTraxx credit additions and eight prior lyric additions; those are **not** new gains from this campaign.

Displayed lyric coverage increased from 1,329 to **2,102** recordings. Source-supplied BPM remains **7,955**, key remains **7,525**, and source credit/collaborator coverage remains **594**. All 6,054 admitted Nina records were checked, with no additional extracted facts beyond their existing metadata. These are current imported-record denominators; they do not include unidentified NFTs or prove full platform coverage.

The final portable source archive is **8,386,127 bytes**. Seven focused tests passed, including every successful checkpoint's exact source ID and SHA-256 of `JSON.stringify(nft.metadata)`. This hash identifies the preserved parsed metadata object, not original HTTP wire bytes. The final empty selection receipt confirms there are no remaining eligible records; use the cumulative summary rather than that zero-row final batch as the campaign total. `data/enrichment-report.json` was refreshed after completion; its audio-analysis counts are only a snapshot of the separately continuing BPM job.

## Resumability and evidence

- `data/metadata-enrichment-identities.json.gz` fixes the imported track → exact NFT identity cohort. Solana IDs remain case-sensitive.
- `data/metadata-enrichment-checkpoint.json` stores successful identity, extractor schema, metadata SHA-256 and checked time. Its separate failures map retains retryable errors.
- `data/metadata-enrichment-sources.json.gz` accumulates original indexed NFT documents. The writer publishes this portable proof before metadata and the success checkpoint every 100 completed rows and on graceful termination. Individual documents are also cached immediately in ignored `work/indexed-metadata-cache`.
- `data/metadata-enrichment-batches/*.json` preserves immutable completed/interrupted batch receipts, including the original 300-document audit. `data/metadata-enrichment-audit.json` is only the latest live/final batch.
- The metadata writer holds `data/music-metadata.json.lock`; the coordinator separately holds `data/indexed-metadata-campaign-status.json.lock`. No audio-analysis file is opened for writing. Corrupt state fails closed instead of silently resetting.

The coordinator makes sequential batches of at most 1,000 records, at most 28 batches per launch. Each worker sends one request at a time with up to 20 exact NFT aliases, 500 ms between requests and a 25-second deadline. Three consecutive provider failures stop the worker and coordinator. A child failure, no useful progress or an exhausted eligible cohort also stops the coordinator. A missing/invalid metadata document is retained as a retryable failure, never an empty success. The same campaign ID avoids repeatedly querying failed identities; a later explicitly chosen campaign ID permits retry. Existing successful identities are skipped unless the extractor version/identity changes or explicit `--refresh` is used.

```sh
node scripts/recover-indexed-music-metadata.mjs --plan --limit=1000
node scripts/run-indexed-metadata-campaign.mjs --campaign-id=source-metadata-2026-11-07
node scripts/report-indexed-metadata-campaign.mjs
```

Before resuming, inspect lock PID/cwd and campaign status. Do not remove a live lock or start a duplicate metadata writer. SIGTERM/SIGINT to the coordinator forwards a graceful stop to its child, which flushes accumulated evidence before releasing its own lock. The campaign ID must remain the same for a continuation that should not retry prior failures. A machine crash can leave a lock requiring inspection; atomic source-first publication permits replay without claiming checkpointed facts lacking portable proof.

Tests check additive/conflicting facts, Solana identity boundaries, next-pass skipping, portable raw hashes for every durable success, prior receipt retention, and coordinator stop rules. No new source lyrics are printed into documentation. Source-supplied tempo/key remain distinct from algorithmic estimates, and a successfully read metadata document is not proof that its recording was auditioned or that every musical field exists.
