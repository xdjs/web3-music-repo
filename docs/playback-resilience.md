# Playback resilience verification — November 6, 2026

The old 12-second loading timer called the hard-error recovery path. An Arweave source has no configured alternate, so the timer could report it unavailable and pause it even while the original request was still loading. This could also prematurely stop the last IPFS gateway attempt.

`createMediaRecovery` now distinguishes a soft loading deadline from an actual media error. `recoverSlow()` advances a finite same-CID gateway list when available; when no alternate remains and the media has no error, it leaves the original request active and displays a slow-loading notice. Actual media errors still exhaust normally. Both archive loading timers use this path. Pause intent, disposed sessions and stale failures remain respected.

The original NOT4ME failure was intermittent: an instrumented live retry before the fix played in about three seconds. We therefore do not claim that run reproduced the earlier failure. A deterministic browser check delayed the actual original Arweave request by 15 seconds without replacing its response. At 13 seconds the player was still unpaused, readyState 0, and displayed the slow-loading message. The real source then played, readyState 4, duration 174.097007 seconds, and restored the normal provenance label. This used the existing 40-second total test budget.

Validation:

- Eight media recovery unit tests pass, including three new tests for slow Arweave loading, subsequent genuine media errors, and final-gateway timeout behavior.
- 29 focused metadata, media, coin and Sound-diagnostic tests pass.
- The complete personal playlist browser test passes: create/add/reorder/reload/rename, NOT4ME playback, next to MIAMI FREESTYLE, mobile queue, remove/delete and artist links.
- The collectors test passes on rerun: 64 wallets, forward-verified cooprecords.eth profile, and playback after navigation. The first run timed out at pagination; its exact cause remains unverified. A separate API read subsequently returned the remaining 14 items before the unchanged browser test passed. This is retained as an external-data reliability limitation.
- Integrated Mija / Jacob Grosse playback, explicit remixer credit, and archived-CDN provenance also pass. It is correctly labeled as an archived Sound transcode, not audio discovered in the current token metadata.

Evidence: `data/playback-timeout-before.json`, `data/slow-playback-verification.json`, `data/playback-regression-verification.json`, and `data/sound-resolution/mija-app-verification.json`. Reproduction scripts: `scripts/verify-slow-playback.mjs`, `scripts/verify-personal-playlists.mjs`, `scripts/verify-collectors.mjs`, `scripts/verify-archived-sound.mjs`.

These are selected-flow checks, not proof that every recovered track plays or that real account login and wallet linking have completed.
