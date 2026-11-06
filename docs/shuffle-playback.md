# Player shuffle

The player has a Shuffle toggle using the existing SVG icon, theme colors, focus behavior and `aria-pressed`. Its preference is saved locally as `mn-archive-shuffle` and applies when another album, artist context or playlist starts. Queue contents are not persisted by this preference.

`src/queue-shuffle.mjs` is a pure queue model with unique occurrence keys, so repeated track IDs are not collapsed. Turning shuffle on randomizes only upcoming entries. History and the current occurrence stay in place; toggle does not touch the media element. Next/Previous traverse the existing shuffled order without reshuffling. Turning it off restores the remaining entries' original relative order. Additions and removals survive both toggles; clearing retains the current audio and preference. A manual queue assembled while shuffle is already enabled receives its shuffle on first playback.

All queue mutations in `archive.js` pass through `applyQueueState`. The next-track preload integration can observe `queue[queueIndex + 1]` after this hook; it must reevaluate on selection, toggle, append, remove and clear. The module must be included in the browser build alongside the other `src/*.mjs` client dependencies.

Verification on local canonical server `http://127.0.0.1:4191`:

- 9 focused shuffle tests plus 4 existing listening-queue tests passed.
- Real Mija audio advanced from 1.011s to 1.371s across toggle; source unchanged, unpaused, no `emptied` or `loadstart` events.
- Browser checked duplicate queue entries, off restoration, stable Next order, removal retention, clear without stopping audio, saved preference after reload and the next context.
- Actual rendered screenshots reviewed at 1440px and 390px in light/dark themes, plus 320px. No horizontal overflow or overlapping controls. Mobile title/source text truncate within the existing compact player; recording-tab gaps narrow below 360px.

Evidence: `data/shuffle-verification.json`, `captures/shuffle-1440-light.png`, `captures/shuffle-1440-dark.png`, `captures/shuffle-390-light.png`, `captures/shuffle-390-dark.png`, `captures/shuffle-320.png`. Run `node scripts/verify-shuffle.mjs` after later player changes. This proof precedes the separately owned next-track preload integration, which needs its own combined regression pass.
