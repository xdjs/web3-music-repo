# Planet X app playback investigation

Pete reports the original recording sounds clean at 1:48 and the doubling occurs only in the application. This supersedes any suggestion that the source recording explains the problem. The application-side cause remains unresolved; no speculative source change or media alteration was made.

The bounded investigation used the local canonical app at `http://127.0.0.1:4191`, source revision `b29ccddfc2d5583c1597e5a43f349b58d6e41abc`, on 2026-11-06. This is a fresh headless Chromium session, not Pete's physical browser session or an auditory confirmation.

The corrected transition run completed with no script/page errors: one tracked element, at most one playing element, zero AudioContexts; playback advanced from108.037 to119.764 seconds, paused at119.773, resumed to131.780, and paused at131.801 seconds. Chrome native events show the prior song pipeline paused and destroyed before the Planet X pipeline was created; no native player errors were recorded. The diagnostic browser closed and both test processes exited.

## Evidence

- `data/planet-x-app-transition-trace.json` records every observed HTMLMediaElement, including detached elements, calls and events for play/pause/load/source/seek changes, AudioContext creation/source nodes, one-second snapshots, and Chrome native Media pipeline events. The sequence is prior song → Planet X → Now Playing open/close → seek to 108 seconds → pause/resume. Native pipeline identities across source replacements do not themselves mean simultaneous playback.
- `data/planet-x-gateway-byte-comparison.json` compares exact AAC packet bytes at 108.010667, 118.016 and 128.000 seconds. Filebase and the independently extracted magic.decentralized-content.com original match all three SHA-256 hashes. Each request returned the precise HTTP206 Content-Range, expected length and CID ETag; only 2,568 bytes were downloaded. This is a bounded sample, not a whole-file verification.
- A separate uninterrupted run logged one tracked/playing element and zero AudioContexts through 230 seconds, followed by normal next-track playback. It used Filebase after fallback. The test's final pause incorrectly targeted the underlying player while Now Playing was open, causing a harness timeout before the native/event dump was written. These console observations are **partial evidence**, not a completed passing trace. The corrected transition run uses the actual modal controls and source magic URL.

The inspected standby preload implementation never calls play before adoption. Adoption pauses the old player, aborts its listeners, replaces it, clears its source and reloads it. Detected video cancels standby buffering. That review and the traces have not established a concrete defect. The absence of a second element in these fresh sessions does not invalidate Pete's report or prove the audible issue fixed. Confirmation in the refreshed physical browser remains pending.

No application source was edited. Diagnostic scripts and source excerpts remain in ignored `work/planet-x-*`; no additional broad downloads or indefinite test loops are running after completion.
