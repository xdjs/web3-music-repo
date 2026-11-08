# Bounded original-media BPM transfers

Patch based on `15c1bb645dd53a61b98266f6407d8e39b0474eb1`, developed in the isolated `web3-music-bpm-transfer` worktree. No canonical recovery writer, deployment or campaign restart was run for this patch.

## Observed failure and evidence limits

The overnight `geniuscorp.fr` batch had 12 saved timeout outcomes and two pending records. Saved `source` values were Pinata URLs, but the actual analyzer path normalized them through `storageURL()` to Filebase. The old receipt did not save attempted URLs, response sizes or transferred bytes, so it cannot establish a Pinata outage or distinguish connection trouble from a large file exceeding the full-download deadline.

Two sampled original CIDs are 175,832,658-byte and 141,093,465-byte MP4 videos. Current bounded probes served both from Filebase and Pinata. The replacement pipeline downloaded and analyzed both successfully; see `data/bpm-large-transfer-verification.json`. They were fast during this verification, so the proof does not establish that the old timeout was specifically caused by slow throughput.

## Transfer behavior

- `--download-timeout-ms` now separately bounds response headers and periods with no body progress. The campaign's existing argument remains 20 seconds.
- A whole-source budget covers all attempts, default 180 seconds; `--total-transfer-timeout-ms` may explicitly set a bounded value up to 600 seconds.
- One source has a cumulative 256 MiB receive budget, shared across fallback attempts. Oversized declared bodies are rejected before downloading; unknown-length bodies are counted while streaming. A last received network chunk can exceed the cap before cancellation; that actual byte count is retained.
- The original source remains unchanged. Fixed gateway candidates come from the existing exact-CID / Arweave-transaction helper. Alternate URLs are fetched directly rather than passed through canonicalization again. No processed/transcoded source is substituted.
- Each gateway is attempted once. Redirects must preserve the exact generated content identity/query or an allowed Arweave content subdomain. Private/unrecognized hosts, identity-changing redirects and unsolicited partial ranges are rejected.
- Attempt evidence includes the actual requested/response URL, HTTP status, content length/type, received bytes, header/progress/elapsed timing, and failure reason. Complete files retain SHA-256 and original URI.
- Source size limits, total expiry with progress, and stalled partial transfers after bounded alternatives produce `status: deferred`, `retryable: true`. These source-specific outcomes do not trip the provider circuit or automatically requeue forever. Other platforms remain eligible.
- No-byte connection failures and rate limits remain `unavailable` provider failures. Existing sustained-provider safeguards remain in place. Rate limiting also sets the analyzer's shared 30-second cooldown before another source starts.
- Temporary original media and mono analysis WAVs are removed after success or failure. No listening copy is published.

## Resume and reporting

Supplied BPM wins throughout; previous estimates, unavailable outcomes and review outcomes remain excluded from ordinary campaigns. Deferred transfers are excluded too. Explicit `--retry-deferred` opts them into a bounded pass; existing `--retry` continues to opt in unavailable records. Neither option rewrites supplied tempo.

The public campaign summary and source-first coverage report both expose a separate `deferred` count. Deferred records still count as missing displayed BPM, with `missingByAnalysisState.deferred`; no successful tempo is invented.

After review, a narrow original-source retry of this known platform can use the existing `--platform=geniuscorp.fr --limit=14 --retry --concurrency=2 --download-timeout-ms=20000`. Do not run it concurrently with the coordinator or another analyzer. Normal campaign continuation can then process untouched platforms. The two proof estimates are **not** automatically imported into `data/audio-analysis.json`; the evidence remains separate until an approved recovery pass runs.

## Verification

Focused tests cover progressive bodies exceeding the connection limit, stalled and oversized sources, bounded fallback and cumulative bytes, rejected redirects/partial responses, exact alternate URLs, source precedence, explicit deferred reporting, and continued eligibility of a healthy platform after source deferrals.

`node scripts/verify-bpm-large-transfer.mjs` performs only the two named videos, sequentially, with a 200 MiB / 180-second per-source transfer cap, at most 400 MiB combined, and two analyzer threads. It writes its own verification receipt, never catalog analysis checkpoints. Both original file lengths matched and temporary media was removed. These algorithmic BPM estimates are not an audition or accuracy guarantee; there is no key inference.

Final validation: 17 focused pipeline/checkpoint tests pass. The attempted full suite had 380 passes and one unrelated failure out of 381: the existing local-video HTTP test could not bind `127.0.0.1` (`listen EPERM`) in the execution environment. That suite ran before the two additional checkpoint-reader tests, which passed separately. Syntax checks and the repository formatting check passed. Full-suite success is not claimed.

Checkpoint reads now fail closed on malformed JSON, invalid record maps and other I/O errors. Only an absent checkpoint (`ENOENT`) can initialize an empty records object; tests confirm existing malformed bytes are not changed.
