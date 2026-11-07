# Resumable BPM campaign

Launched November 6, 2026, on `feat/sound-bpm-coverage`, following the user’s authorization to analyze tracks without supplied BPM. This is local background work; it is not an always-on cloud service and does not deploy results automatically.

At launch, supervisor PID **10134** / exec session **99796** was genuinely running and waiting for the existing Sound analyzer PID **7905** / session **80310**. `data/bpm-campaign-status.json` is the current status; these initial PID values become stale after a restart. No second analyzer was started while the Sound lock existed.

- Existing Sound pass: 3,741 previously untouched records, two workers, 20-second download timeout. It skips supplied tempo and previously unavailable/review records.
- Coordinator: finishes remaining Sound pending work after an interruption, then rotates platform batches of at most 50. Eligibility and catalog/source metadata are refreshed between batches; the analyzer rechecks supplied BPM before each track.
- Estimates are stored only in `data/audio-analysis.json`. Supplied metadata remains in `data/music-metadata.json`, under its separate lock. Keys are never inferred.
- CPU cap: at most two Open BPM analysis threads per analysis process, two workers. Temporary original-media downloads are removed after analysis; no new listening copies are published.
- Idle existing-worker polling is 15 seconds; owned-worker failure monitoring is 5 seconds. Public status contains aggregate source-first coverage, active/waiting process state and batch outcomes. Ignored detailed logs are under `work/bpm-campaign/`.
- The coordinator has its own `data/bpm-campaign-status.json.lock`. It never deletes or steals `data/audio-analysis.json.lock`. A stale/invalid lock blocks for inspection; a live but stalled worker is reported as waiting.
- Eight provider/network failures in the last ten outcomes, or four rate limits in the last five or more outcomes, stops continuation. The coordinator can gracefully signal only an analyzer it spawned. If the existing external Sound worker hits that threshold, the coordinator stops and reports the condition without signaling that worker.
- Interrupting the coordinator signals its own current child for graceful checkpointing. It does not stop an externally started analyzer. Restarting it resumes pending work; failed/review outcomes remain excluded unless separately authorized for retry.

Commands:

```sh
node scripts/run-bpm-campaign.mjs
node scripts/report-bpm-coverage.mjs
node --test tests/bpm-campaign.test.mjs
```

Four tests cover supplied-tempo protection, excluded attempt states, pending Sound resumption, fair platform rotation, sustained-error thresholds and source-first aggregate counts. Actual launch verified waiting behind the original live lock; the automatic handoff to later batches has not yet happened, so that transition is not claimed as production-tested.

Do not commit or deploy a moving `audio-analysis.json` checkpoint. Coordinate a graceful stop and frozen checkpoint before release. On restart, inspect any retained lock PID/cwd and checkpoint freshness rather than deleting it blindly.
