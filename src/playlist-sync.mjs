import {
  GUEST_PLAYLIST_KEY,
  playlistStorageKey,
  readPlaylistCache,
  mergePlaylistLibraries,
  samePlaylists,
} from "./playlist-library.mjs";
export function createPlaylistSync({
  storage,
  request,
  onLibrary = () => {},
  onStatus = () => {},
  isOnline = () => true,
  isVisible = () => true,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  debounceMs = 700,
  pollMs = 30000,
}) {
  let identity = null,
    key = GUEST_PLAYLIST_KEY,
    generation = 0,
    controller = null,
    timer = null,
    running = false,
    again = false,
    retries = 0,
    enabled = true,
    disposed = false;
  let status = {
    state: "guest",
    message: "Saved on this device. Sign in to sync playlists.",
    canRetry: false,
  };
  const emit = (state, message, canRetry = false) => {
    status = { state, message, canRetry };
    onStatus(status);
  };
  const cache = () => readPlaylistCache(storage, key);
  const persist = (value) => storage.setItem(key, JSON.stringify(value));
  const notify = () => onLibrary({ accountId: identity, key });
  function schedule(ms = debounceMs) {
    clearTimer(timer);
    if (identity && enabled && !disposed)
      timer = setTimer(() => {
        timer = null;
        if (ms === pollMs && !isVisible()) schedule(pollMs);
        else void sync();
      }, ms);
  }
  function stop() {
    generation++;
    controller?.abort();
    controller = null;
    clearTimer(timer);
    timer = null;
    running = false;
    again = false;
  }
  async function sync() {
    if (!identity || !enabled || disposed) return;
    if (running) {
      again = true;
      return;
    }
    if (!isOnline()) {
      emit("offline", "Saved on this device — waiting for a connection.", true);
      return;
    }
    running = true;
    again = false;
    const version = generation;
    controller = new AbortController();
    const signal = controller.signal;
    const current = () =>
      !disposed && version === generation && !signal.aborted;
    emit("saving", "Saving playlists…");
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const remote = await request("/api/account/playlists", { signal });
        if (!current()) return;
        if (
          !Number.isSafeInteger(remote.revision) ||
          !Array.isArray(remote.playlists)
        )
          throw Error("Playlist service returned an invalid library.");
        const local = cache();
        const acknowledged =
          local.pendingWrite &&
          samePlaylists(remote.playlists, local.pendingWrite.playlists);
        const merged = mergePlaylistLibraries(
          acknowledged ? local.pendingWrite.playlists : local.base || [],
          local.playlists,
          remote.playlists,
        );
        const notice = merged.conflicts
          ? `Conflicting changes in ${merged.conflicts} playlist${merged.conflicts === 1 ? "" : "s"} were preserved for review.`
          : local.notice || "";
        const next = {
          ...local,
          base: remote.playlists,
          revision: remote.revision,
          playlists: merged.playlists,
          pendingWrite: null,
          notice,
        };
        persist(next);
        if (!samePlaylists(local.playlists, next.playlists)) notify();
        if (samePlaylists(next.playlists, remote.playlists)) break;
        if (next.playlists.length > 100) {
          emit(
            "conflict",
            "All playlists are preserved on this device. Reduce this library to 100 playlists to sync.",
            true,
          );
          return;
        }
        const sent = structuredClone(next.playlists);
        persist({
          ...next,
          pendingWrite: { revision: remote.revision, playlists: sent },
        });
        try {
          const result = await request("/api/account/playlists", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              revision: remote.revision,
              playlists: sent,
            }),
            signal,
          });
          if (!current()) return;
          if (!Number.isSafeInteger(result.revision))
            throw Error("Playlist save was not confirmed.");
          const latest = cache();
          if ((latest.revision || 0) <= result.revision)
            persist({
              ...latest,
              base: sent,
              revision: result.revision,
              pendingWrite: null,
            });
          else again = true;
          if (!samePlaylists(latest.playlists, sent)) again = true;
          break;
        } catch (error) {
          if (!current()) return;
          if (error.status === 409 && !error.needsMusicNerdAccount) {
            if (attempt < 2) continue;
            emit(
              "conflict",
              "Changes are safe on this device. Another device is updating this library; retry sync.",
              true,
            );
            return;
          }
          throw error;
        }
      }
      retries = 0;
      const saved = cache();
      if (again || !samePlaylists(saved.playlists, saved.base || [])) {
        emit("saving", "Saving playlists…");
        schedule();
      } else {
        emit(
          "saved",
          saved.notice
            ? "Saved · " + saved.notice
            : "Saved to your Music Nerd account.",
        );
        schedule(pollMs);
      }
    } catch (error) {
      if (!current()) return;
      const offline = !isOnline();
      emit(
        offline ? "offline" : "retry",
        offline
          ? "Saved on this device — waiting for a connection."
          : error.needsMusicNerdAccount
            ? "Finish your Music Nerd account setup to sync playlists. Changes remain on this device."
            : "Changes are saved on this device. Account sync is unavailable; retry to reconnect.",
        true,
      );
      if (!offline && retries < 3) {
        retries++;
        schedule(5000 * retries);
      }
    } finally {
      if (current()) {
        running = false;
        controller = null;
      }
    }
  }
  return {
    snapshot: () => status,
    setAccount(id, { syncEnabled = true } = {}) {
      stop();
      identity = id || null;
      key = playlistStorageKey(identity);
      enabled = syncEnabled;
      retries = 0;
      if (!identity) {
        notify();
        emit("guest", "Saved on this device. Sign in to sync playlists.");
        return;
      }
      try {
        const previous = cache(),
          guest = readPlaylistCache(storage, GUEST_PLAYLIST_KEY).playlists;
        const oldGuest = previous.guestBaseline || [];
        // Device-only deletions are not instructions to delete an account copy.
        const guestWithUnchangedRemovals = [
          ...guest,
          ...oldGuest.filter((p) => !guest.some((g) => g.id === p.id)),
        ];
        const merged = mergePlaylistLibraries(
          oldGuest,
          guestWithUnchangedRemovals,
          previous.playlists,
        );
        persist({
          ...previous,
          base: previous.base || [],
          playlists: merged.playlists,
          guestBaseline: guest,
          notice: merged.conflicts
            ? "Conflicting device playlist changes were preserved for review."
            : previous.notice || "",
        });
        notify();
        if (!enabled) {
          emit(
            "disabled",
            "Saved on this device. Account playlist sync is not enabled on this copy.",
          );
          return;
        }
        void sync();
      } catch {
        notify();
        emit(
          "retry",
          "Browser storage could not be read or updated. Existing playlists have been left in place.",
          true,
        );
      }
    },
    changed(changedKey) {
      if (changedKey !== key || !identity) return;
      if (!enabled) {
        emit(
          "disabled",
          "Saved on this device. Account playlist sync is not enabled on this copy.",
        );
        return;
      }
      retries = 0;
      emit(
        isOnline() ? "saving" : "offline",
        isOnline()
          ? "Saving playlists…"
          : "Saved on this device — waiting for a connection.",
        !isOnline(),
      );
      if (enabled) schedule();
    },
    refresh() {
      if (isVisible()) {
        retries = 0;
        void sync();
      }
    },
    retry() {
      retries = 0;
      void sync();
    },
    dispose() {
      stop();
      disposed = true;
    },
  };
}
