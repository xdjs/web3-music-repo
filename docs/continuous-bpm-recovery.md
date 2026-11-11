# Continuous BPM recovery

Start with `npx tsx scripts/supervise-bpm-recovery.mjs --concurrency=1` from the isolated campaign checkout. `--inspect` is read-only. The supervisor has its own single-writer lock, observes an existing campaign/analyzer without starting a second writer, and starts the ordinary first-pass campaign when needed.

After the first pass it retries explicit batches of at most 50 unavailable/deferred record IDs. Supplied tempo, completed estimates and uncertain results are preserved. Unsupported duration/no-audio/invalid-result cases and files above the bounded size limit remain held for separate investigation. Retry completion is tracked per ID and timestamp, so an interrupted batch does not falsely exhaust its untouched IDs. The new analyzer `--record-ids-file=` option is restrictive even for an empty array; malformed/empty filenames fail closed.

Sustained provider failures trigger 15/30/60-minute cooldowns. Completed retry rounds wait 24 hours before checking unresolved sources again. Each retry has a five-minute total transfer budget, 20-second headers/no-progress limits, one analysis worker by default, two Open BPM threads per child and the existing 256 MiB media limit. Original media is never rewritten. The supervisor saves one latest review checkpoint after every 500 additional estimates; these files are not automatically published.

Status: `data/bpm-recovery-supervisor.json`. Logs and the latest checkpoint: `work/bpm-recovery-supervisor/`. Stale/unrecognized locks stop the supervisor for review; they are never removed automatically. The computer and network must remain available.

To stop, create `work/bpm-recovery-supervisor/STOP` or signal the supervisor with SIGTERM. It signals its own child once, waits for that child's safe checkpoint and releases its lock. If it is observing a campaign that was already running, that external campaign is not signaled: the operator must also stop the exact campaign PID from its verified lock. Remove the STOP file only when explicitly resuming. Never signal an unverified/reused PID or start a second analysis writer.

Verification covers selection restrictions, preserved source/estimated/review states, completed-ID tracking after interruptions, and an actual zero-job analyzer invocation. An attached-worker smoke verifies that the supervisor does not create a second writer and that stopping observation leaves the external worker intact.
