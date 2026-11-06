# Automatic playlist synchronization

Implemented in the account and playlist components. Manual Save/Load controls are removed. Signed-in edits are stored locally immediately and synchronized after a 700ms debounce. The profile and playlist views show Saving, Saved, offline or retry status. The configured backend must advertise private Blob or archive-server storage; unavailable storage is never presented as successful account sync.

## Isolation and initial merge

The original `mn-archive-playlists-v1` key remains the device-only guest library. Each Privy identity has its own `mn-archive-account-library-v1:<encoded identity>` cache. Server ownership is still determined by the existing verified JWT/canonical Music Nerd account lookup; a browser cache key grants no authorization.

On sign-in, guest changes are merged into that account's cached library and then reconciled with its latest server revision. A per-account guest baseline prevents unchanged guest lists from resurrecting remotely deleted account playlists. Deleting a device-only guest playlist after logout is not an instruction to delete an existing account copy. Logout immediately aborts pending sync and switches the UI back to the preserved guest library. Another account can import that guest library, but never receives the previous account's private cache.

An open rename/create/delete dialog closes when the account scope changes. Form and delete callbacks also retain their opening scope. The initial component handshake is deferred until the playlist component has finished mounting, so an account module that loads before the catalog cannot trigger a premature route render.

## Conflicts, deletions and interruptions

Each cache retains the last server base, revision, working library, guest baseline and any pending write. Reconciliation compares the base, local working copy and latest remote library by playlist identity and content. A one-sided change or deletion applies normally. Conflicting name, track or order edits retain the remote version and a local `(recovered edit)` copy; concurrent delete/edit conflicts retain the edited content and show a review notice rather than silently discarding it. No current account list is replaced by a blind load.

If a write succeeds but its response is lost, the next read can recognize that exact pending payload. Later local edits then reconcile against that acknowledged content without creating a false conflict copy. A 409 refreshes and merges again, with three bounded attempts. Libraries above the existing 100-playlist limit remain locally preserved and require reduction before account sync.

Edits made offline persist in the per-account cache across reload. Online, focus and visibility events refresh sync, and visible signed-in tabs poll every 30 seconds for other-device changes. Background polling skips requests while hidden. Transient failures use three bounded retry delays, then leave an explicit retry action. Generation and abort checks prevent late responses from applying after logout or an account switch. Unreadable local data is left intact; the playlist view shows an error and writes are blocked instead of replacing it with an empty library.

## Verification and boundary

Ten focused unit tests cover guest isolation, remote and local deletions, offline reload, conflict preservation, 409 retries, lost acknowledgments plus further edits, account-switch races, unavailable storage and corrupted cache retention. `scripts/verify-playlist-sync.mjs` exercises real account and playlist components against an explicitly mocked Privy identity and optimistic-revision HTTP service: initial merge, automatic create, offline reload/reconnect, conflicting edits, a second-device deletion, account switch while editing, and logout. Screens at 1440/390 in light/dark were visually inspected. See `data/playlist-sync-ui-verification.json` and `captures/playlist-sync-*.png`.

`verify-privy-profile.mjs` now checks automatic sync instead of the removed manual controls while retaining linked-wallet/add/connect, setup retry and logout coverage. These fixtures do not claim a completed real-account cross-device session: no OTP, wallet signature or production playlist write was performed during automated QA.

## Renamed public URL

The new URL is `https://web3-music-archive.vercel.app`; the previous `https://web3-music-repo.vercel.app` remains available. Both use the same Music Nerd account and account playlist storage. Browser-local guest playlists do not automatically cross origins. Once this release is live, sign in at the old URL and wait for **Saved** to bring those guest playlists into the account, then sign in at the new URL. No redirect or destructive browser-storage migration is performed.
