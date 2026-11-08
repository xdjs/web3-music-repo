# Full-cohort BPM and source metadata campaign

Started November 6, 2026 at Pete Rango's request to label substantially more of the archive with BPM, across platforms. This is ongoing local recovery work, not a production deployment.

## Current checkpoint — November 7 evening

The bounded transfer fix is merged and deployed. Public source `23dc3fb217ba856664a08b53007a1778690297fe` contains 50,633 recordings and 17,105 displayed BPM values. The newer worker is isolated at `/Users/peterarango/Documents/Music Nerd/Apps/web3-music-bpm-campaign` on `recovery/bpm-resume`, based on `109189f`. Do not merge or overwrite its moving analysis output. See `data/bpm-resume-status-2026-11-07.json` in the canonical repo for the latest observed state and the isolated worktree's actual status/locks before resuming.

The existing `npx tsx scripts/run-bpm-campaign.mjs` invocation successfully makes bounded network requests in this execution environment; a plain-node attempt returned immediate zero-byte failures. All twelve additional geniuscorp retry records succeeded. The wider Sound pass also produced estimates and checkpointed safely before release playback QA. Preserve old failure evidence; no result establishes permanent source loss. The worker still uses two concurrent media jobs and source-supplied BPM takes precedence. Keys are not inferred. Background work requires this computer and network to remain available.

The sections below are historical campaign checkpoints. Current production and worker receipts take precedence over their state claims.

## Checkpoint November 7

Source metadata campaign completed all 27,520 identities with zero failures. The BPM coordinator stopped after repeated download timeouts while using Filebase (saved original URLs were Pinata). Two sampled CIDs currently respond and contain141/176 MB videos; a20-second full-body deadline likely contributed, but historical logs cannot prove the failure stage. No campaign workers or output locks remained at the 18:09 UTC check. Local BPM coverage is 8,329/9,833 Sound and 17,066/37,345 total. Restart requires diagnosing gateway fallback first; the descriptions below record the launched workflow, not current liveness.

## Launched work

- Existing Sound analyzer: 3,741 previously untouched Sound recordings selected; two workers, 20-second download request deadline, at most two Open BPM analysis threads per child. Source-supplied BPM wins. Prior unavailable and needs-review entries are excluded from this initial pass.
- BPM supervisor: waits for the existing analyzer without taking its lock, then resumes remaining Sound work and rotates through other platforms in 50-record batches. It checkpoints and stops for sustained provider failures. A stale or invalid lock is reported, never deleted automatically.
- Source metadata recovery: continues exact NFT reads beyond the initial 300-record cohort, keeping cumulative original indexed metadata evidence and per-batch receipts. This uses a different output lock from the audio analyzer. Check its campaign status before starting any replacement worker.

Read `data/audio-analysis.json`, `data/bpm-campaign-status.json`, their `.lock` files, and metadata campaign status to identify current PIDs and progress. PIDs in old chat messages are not sufficient proof of ownership. At initial launch the Sound analyzer was PID7905 and the supervisor PID10134; these may change on restart.

`node scripts/report-bpm-coverage.mjs` produces a current local, source-first coverage report. Its totals are mutually exclusive (supplied versus estimated), exclude uncertain results from displayed BPM, and are not necessarily the published numbers.

## Publication boundary

Do not commit or deploy mutable outputs while recovery writers are active. Take a deliberate stable checkpoint, regenerate coverage/enrichment reports, verify source provenance and the displayed estimates, run applicable checks, then publish that reviewed snapshot. Existing production remains at source commit `d0e9e24643f5ce79b485c435bd9ccdf33f627f42` until a later release receipt establishes otherwise.

Audio estimates are approximate and may be half/double tempo. Low-confidence results remain needs-review, unavailable sources remain retryable, and missing tempo is not filled with a guessed value. Musical keys are not inferred by Open BPM. Downloaded audio stays in ignored temporary work storage; no new listening copies are produced.

Progress is checkpointed on disk. The workers require the local computer and network; interrupted runs should resume from their checkpoints after active/stale locks are inspected. No completion time or all-track success is promised.
