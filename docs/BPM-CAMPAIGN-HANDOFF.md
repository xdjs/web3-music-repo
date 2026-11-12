# Full-cohort BPM and source metadata campaign

## Latest release — November 11: BPM visible without filtering

Live coverage is **29,538 / 50,633** tracks (8,008 supplied;21,530 estimates), including619 additional estimates. Known tempo now appears automatically on shared song cards in Explore, Home, artist and collection grids. `~` identifies an estimate; unknown tempo remains unlabelled. Filters and sorting still work. Playlist/queue rows were not changed.

PR23 merged at `dbaeadf1aa398f886ac5edc82adea8643ee32585`. Exact source `34564f3c69d198fdce819eea512d249d2f404e88` was tested and promoted as `dpl_Fjsuu83pSqS6ova5RGWZSUEh7EhP`. Four desktop/mobile light/dark browser checks passed; the primary site's client and complete index match the tested build byte-for-byte. See `data/release-bpm-checkpoint-2026-11-11b.json` and its linked staged browser receipt.

Recovery continues in the isolated campaign worktree. The supervisor now owns its coordinator, unlike the historical external-worker state below. Use `work/bpm-recovery-supervisor/STOP` for a stop request and wait for checkpoint/lock release. Inspect current status before touching processes; never start a duplicate writer or overwrite the moving full raw analysis. PR24 fixes mixed-case platform rotation so all eligible platforms receive turns. Latest observed worker status is recorded in the release receipt; timestamps/PIDs are observations, not liveness guarantees.


Started November 6, 2026 at Pete Rango's request to label substantially more of the archive with BPM, across platforms. This is ongoing local recovery work, not a production deployment.

## Current checkpoint — November 11

Keep recovering until Pete explicitly requests stop. The live reviewed checkpoint is28,919 BPM values (8,008 supplied;20,911 estimates); source-first Sound coverage is89.7%. The mutable local worker has21,128 raw estimates and remains unpublished beyond the frozen release. Current coordinator PID66561 and supervisor PID74429 were observed with fresh heartbeats; PIDs are not a liveness guarantee.

The single-writer supervisor follows first-pass work with bounded explicit-ID retries, provider cooldowns and daily retry rounds. It preserves uncertain/unsupported cases and creates a latest review checkpoint every500 new estimates. It never auto-publishes unchecked results. Status/control and stop details are in `docs/continuous-bpm-recovery.md`, `data/bpm-resume-status-2026-11-11.json` and the actual campaign worktree. Do not launch a duplicate writer or replace its full raw checkpoint with the compact production projection.

Current production is lazy-startup deployment `dpl_E1PxTPuwvq67osVQ9jnPNsyh6Vit`, retaining the same BPM dataset and corrected v4 thumbnail. The earlier frozen BPM checkpoint deployment and the follow-up startup correction have separate exact-source receipts. Historical checkpoints below are superseded by this section.

## Current checkpoint — November 9

PR #17 is merged and its exact tested production build is live. Published BPM coverage is **17,117 / 50,633** (8,008 supplied and 9,109 estimates). Explore now supports BPM range filtering/sorting; see `docs/bpm-discovery.md` and `data/release-bpm-metadata-2026-11-09.json`.

The isolated campaign resumed with `npx tsx scripts/run-bpm-campaign.mjs --concurrency=1`, coordinator PID 95436 at the observed checkpoint. It remains separate from production. The latest saved observation had 9,408 local estimates and active progress; read the actual worktree status/locks for current liveness. Do not merge its moving analysis file or launch another writer. The checkpoint's old reason string predates this run and is stale; the integrated coordinator clears it on future starts.

The failed-download diagnosis found repeated immediate zero-byte connection failures, while a complete retry succeeded. Structured network codes and a latched provider-failure circuit are now preserved. See `docs/bpm-resume-network-diagnosis.md`. Prior failures remain retryable; no permanent source-loss claim. Source BPM still wins, uncertain estimates remain withheld, keys are not inferred, and original playback media is unchanged. This computer and network are required for ongoing work.

Take a deliberate stable analysis checkpoint, regenerate coverage/enrichment reports, review source/provenance and tests, then publish newer estimates. `data/bpm-resume-status-2026-11-09.json` records an observation, not a liveness guarantee. Historical checkpoints below are superseded by this section.

## Historical checkpoint — November 7 evening

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
