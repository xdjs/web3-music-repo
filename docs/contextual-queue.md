# Contextual queue start

A fresh browsing queue starts with the selected recording. Clicking the fourth recording in A, B, C, D, E creates D, E, A, B, C at index zero. Earlier cards remain upcoming rather than appearing as unplayed history. Repeated cards for the same recording are deduplicated, as before.

Explicit playlists/queues retain their supplied order and selected occurrence. Next/Previous use the existing queue array and never rotate again. Manual queue additions, removal and dragging preserve that mode. Shuffle randomizes only the upcoming portion; disabling it restores the rotated browsing order. Duplicate entries in explicit queues retain unique occurrence keys.

The implementation uses one helper in `src/listening-queue.mjs`, shared by the live shuffle queue. No archive rendering, playback, preloading or CSS changes were required.

Validation: 20 queue unit tests pass, including fourth selection, toggling shuffle, Next, fresh contexts, duplicate occurrences and explicit drag order. `scripts/verify-contextual-queue.mjs` clicks the fourth Pete Rango result (Breakdown) with shuffle off and remembered on, checks no tracks are lost, checks Next, and then verifies an explicit three-entry queue containing a duplicate survives browsing selection and keyboard reordering. `data/contextual-queue-verification.json` records the browser result. This is queue interaction verification, not an upstream-media availability claim.
