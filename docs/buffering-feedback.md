# Playback feedback

The shared playback controls show a loading ring around the still-actionable Pause icon. The compact player and Now Playing also announce a concise transient status: Loading, Buffering, or Seeking. No storage/provenance label is added to player chrome.

Feedback is derived from requested playback, pending startup, native readiness, current time and seeking. A stalled network event with playable buffered media does not show buffering. Pause, ended and error clear the busy indicator. Existing retry/error messages remain available in the compact player. Reduced-motion users see a static indicator. Unchanged state updates retain the button DOM.

Verification: `node --test tests/playback-controls.test.mjs` (6 tests). `scripts/verify-buffering-feedback.mjs` exercises the actual app at 1440 and 390 pixels in light/dark themes. It deliberately holds the approved local Planet X MP4 response, verifies pause during loading and actual native playback after release, then injects readiness/waiting/error UI fixtures. These fixtures do not establish remote-provider reliability. Receipt: `data/buffering-feedback-verification.json`; captures: `captures/buffering-{compact,expanded}-{1440,390}-{light,dark}.png`.

A separate 390×667 short-screen check confirms the transport remains in view (`data/buffering-short-screen-verification.json`, `captures/buffering-expanded-390-short.png`). The black video area in loading captures reflects the deliberately withheld response. No playback, recovery-source or next-track preload behavior was changed.
