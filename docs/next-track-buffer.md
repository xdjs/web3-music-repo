# Next recording buffer

The player prepares one upcoming audio recording while the current recording plays. On Next or automatic queue advance, the actual native media element becomes the active player. Its source and buffer are retained; this is not a speculative fetch whose data the player might download again.

`src/next-track-buffer.mjs` owns the standby, and `src/archive.js` adopts it and rebinds controls/recovery events. Queue mutations use the existing `applyQueueState` hook. The cache context uses the queue occurrence key, so duplicate recordings remain separate listening positions. Shuffle, drag reorder, remove and clear invalidate the target as needed.

## Limits and current playback priority

- One candidate, a 700ms debounce, and at most four starts per minute.
- Warming starts only while current audio is playing with ten seconds of contiguous native buffer ahead, or its entire shorter remaining duration buffered.
- A candidate gets 20 seconds to buffer roughly ten seconds of audio (or its full shorter duration). A timed-out or failed candidate is not repeatedly retried in that queue context.
- Once ready, `preload="none"` asks the browser to stop requesting more data. This is a browser hint, not a byte cap: WebKit downloaded the full short test recording before reporting progress.
- Incomplete requests are canceled when current playback needs data or pauses. A ready buffer can survive pause and be reused. Visibility loss, offline, Save-Data, and reported 2G/3G connections cancel warming. Video candidates are excluded.
- No autoplay occurs in the standby. There is no whole-library download, service worker, crossfade, or sample-accurate gapless guarantee.

When selected before it finishes buffering, the same in-flight element is adopted, preserving its request. A canceled or failed candidate uses the existing normal playback and finite media-gateway recovery path. Event listeners on the retired player are aborted before its source is released. Volume, mute, playback rate, the `audio` element ID, player controls and the video class are preserved.

A browser gesture rejection (`NotAllowedError`) leaves the selected recording ready and asks the listener to press Play; it does not treat that policy rejection as a broken gateway. Desktop Playwright WebKit passed unmuted automatic queue advance. Physical iOS Safari is unverified and can enforce different per-element autoplay restrictions.

## Verification

`node --test tests/next-track-buffer.test.mjs tests/media-preload.test.mjs tests/queue-shuffle.test.mjs` passed 27 tests at integration. These cover buffer adoption, partially loaded adoption, stale events, source/queue replacement, cancellation, deadlines, retry limits, current buffer headroom, hidden/offline/slow-data policy, and duplicate-safe queue operations.

`scripts/verify-next-track-buffer.mjs` uses actual OFF THE LEASH and ROUND N ROUND media in the real local app. It records native element identity, request counts, `loadstart`/`emptied`, volume/mute, native playback progress, and control behavior. `BROWSER_ENGINE=webkit TRANSITION_MODE=ended` checks automatic native ended advance. `TRANSITION_MODE=blocked` injects a one-time browser policy rejection, then verifies actual playback resumes from the Play button; the audio itself remains real.

Evidence files:

- `data/next-track-buffer-chromium-next-verification.json`: after the headroom/20-second change, 15.318 seconds buffered, same native element, one media request before and after Next, no reload/reset, 24.5ms request-to-playing in this run.
- `data/next-track-buffer-webkit-ended-verification.json`: desktop WebKit automatic unmuted native ended advance. Its handoff measurement includes the test's seek-to-end latency and is not a measured inter-song audible gap.
- `data/next-track-buffer-cold-source-20s.json`: one real cold Arweave MIAMI FREESTYLE attempt still returned no usable buffer by 20,012ms and was canceled. Current OFF THE LEASH continued normally (20.72 seconds elapsed, readyState 4, no errors). This gateway remains a source-latency limitation; more preload time does not guarantee availability.

Earlier `data/next-track-buffer-verification.json` and `data/next-track-buffer-cold-source.json` describe the initial 6.5-second policy and are superseded by the named final reports above.
