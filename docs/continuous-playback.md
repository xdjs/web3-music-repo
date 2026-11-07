# Continuous playback

Autoplay is on by default, with a persisted on/off control in the existing listening queue. The queue keeps about 20 upcoming recordings and replenishes as playback advances. Full filtered Explore or artist results are captured when browsing starts playback; changing pages later does not silently replace that context. Other browsing surfaces use the available recording cards. After the context runs out, discovery draws from a catalog shuffled once for the session.

Generated continuation avoids recordings already attempted or removed during the tab session. Explicit playlist duplicates and manual selections remain allowed. Play Next and Add to queue precede generated entries; reordering preserves the user's chosen order. Shuffle preserves manual priority, context before discovery, and the current occurrence. Disabling Autoplay removes untouched broader recommendations while keeping the selected context and manual choices. Clear empties the queue and switches Autoplay off. Adding a song after Clear puts it first up next without falsely marking it as the still-playing track.

Explicit playlists remain intact and can exceed the generated queue target. Broader continuation rows are labeled Autoplay. Past queue entries and exclusions remain in memory for the tab session; no server listening-history write is introduced.

Confirmed exhausted media in automatic continuation produces a visible three-second notice before advancing, capped at three consecutive skips. Delays alone never skip. A failed explicitly queued or playlist entry stops for retry or Next. Native progress beyond two seconds resets the failure streak. Skip eligibility requires active playback intent at failure: late errors after Pause or Story preview do not restart playback. An existing skip timer is also cancelled when Story playback starts. Explicit user resume starts a fresh recovery attempt when needed.

A useful partial buffer survives the first active-player soft deadline. The player rechecks after 18 seconds: stagnant partial ranges then permit the remaining same-content gateway fallback; growing partial ranges get at most three grace checks, and playable native readiness retains the buffer. The final slow request stays alive without a repeated timer when no alternatives remain. No new transcodes, media substitutions, or paid services were added.

## Playlist actions

The shared recording card now includes a playlist-plus button beside Like. Explore, artist, liked, home, wallet and collector cards receive it through the same renderer. Queue rows also expose it. These buttons use the existing delegated playlist editor, preserving the current page and playback. Recovered/shared playlist rows retain their existing Add actions.

## Verification

- Queue, media recovery and next-buffer unit tests cover replenishment, exclusions, explicit duplicates, manual priority, shuffle restoration, Clear, bounded hard-error decisions, paused intent, and progress-aware recovery grace.
- `data/continuous-queue-verification.json`: desktop 1440 and mobile 390, both themes. Actual app/catalog UI with the approved local MP4 as an explicit deterministic media fixture. Fourth-track context, priority, reorder/current occurrence, clear, duplicate playlist continuation, disabling Autoplay and Add after Clear all passed. Captures: `captures/continuous-queue-*.png`.
- `data/card-playlist-actions-verification.json`: the same four views verify actual local playlist saves from cards without navigation, artist/queue pickers, plus an injected late-error-after-export-pause regression and explicit resume. Media responses are a deterministic fixture; actual export encoding is checked separately. Captures: `captures/{card,queue}-playlist-actions-*.png`.
- `data/continuous-playback-source-verification.json`: actual existing sources. Consent started in 11.673 seconds from original Arweave; Endless in 0.903 seconds and Army of Love in 1.211 seconds from their existing approved Spinamp copies. Each advanced beyond 2.5 seconds at readyState 4. This is startup evidence, not full-song listening.
- `data/continuous-slow-handoff-verification.json`: actual Supercollector audio pair under Chromium network emulation (250 ms latency, 192 KiB/s download). Standby retained 3.714 seconds through Pause; native ended adopted the same element without src/load/emptied reset or a redundant zero-range request. The 0.7 ms ended-to-playing event interval is one observation, not a gapless or physical-mobile guarantee.

Stories integration in archive.js reads the full-record API's `record` envelope. Explicit export preview/render pauses the main player and cancels pending playback intent and timers, preventing restart behind the export.
