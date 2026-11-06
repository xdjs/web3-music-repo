# Queue reordering

Queue rows reuse the existing dialog, buttons, typography, artwork, and theme tokens. Drag the six-dot handle with a mouse or touch, or focus it and press Arrow Up/Down. A seven-pixel movement threshold keeps a handle tap from changing order. Scrolling outside the handle remains native.

Every queue occurrence has a distinct key, including repeated recordings. Moving the playing occurrence changes its queue index without replacing the audio or seeking. Explicit reordering also becomes the order restored when shuffle is disabled. Next follows the resulting order, and removals and clearing retain their existing behavior.

All mutations pass through `applyQueueState`, which reevaluates the next-track buffer. The buffer context includes the current occurrence key so repeated recordings remain distinct. An open queue refreshes on playback advance. Refreshing or closing the dialog cancels an active drag and its autoscroll before replacing rows; releasing a stale pointer cannot commit a move.

## Verification

`node --test tests/queue-shuffle.test.mjs tests/listening-queue.test.mjs`: 16 passing tests, including duplicate occurrences, moves across the playhead, removals, shuffle restoration, and invalid moves.

`scripts/verify-queue-reorder.mjs` passed against the canonical local server at `http://127.0.0.1:4191` on 2026-11-06. Evidence is in `data/queue-reorder-verification.json` and `captures/queue-reorder-{1440,390}-{light,dark}.png`.

The browser checks used real Mija audio: playback advanced from 1.452598 to 1.950122 seconds with the same source and no pause/load events while moving the current occurrence. Mouse, keyboard, native touch dragging, native touch scrolling, Next order, and shuffle-off preservation passed. A real native ended event advanced playback while the queue was open and a drag was active; the highlight updated, drag/autoscroll stopped, and the later pointer release left the queue unchanged.

The rendered light/dark dialog was checked at 1440px and 390px with no overflow. Mobile artwork loaded with a natural width of 1000px. This is local interaction and sample playback evidence, not a production deployment or full-catalog playback claim.
