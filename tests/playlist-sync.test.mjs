import test from "node:test";
import assert from "node:assert/strict";
import { createPlaylistSync } from "../src/playlist-sync.mjs";
import {
  GUEST_PLAYLIST_KEY,
  playlistStorageKey,
  readPlaylistCache,
  writePlaylistLists,
  mergePlaylistLibraries,
} from "../src/playlist-library.mjs";
const p = (id, name = id, recordIds = [id]) => ({ id, name, recordIds });
const storage = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) || null, setItem: (k, v) => m.set(k, v) };
};
const tick = async () => {
  for (let i = 0; i < 12; i++)
    await new Promise((resolve) => setImmediate(resolve));
};
function harness({
  remote = { revision: 0, playlists: [] },
  disk = storage(),
  request,
  online = true,
} = {}) {
  const timers = new Map(),
    states = [],
    libraries = [];
  let counter = 0;
  const calls = [];
  const server = async (path, options = {}) => {
    calls.push({ method: options.method || "GET", body: options.body });
    if (options.method === "PUT") {
      const v = JSON.parse(options.body);
      if (v.revision !== remote.revision)
        throw Object.assign(Error("conflict"), { status: 409 });
      remote.revision++;
      remote.playlists = structuredClone(v.playlists);
      return { revision: remote.revision };
    }
    return structuredClone(remote);
  };
  const sync = createPlaylistSync({
    storage: disk,
    request: request ? (...args) => request(server, ...args) : server,
    isOnline: () => online,
    onStatus: (s) => states.push(s),
    onLibrary: (l) => libraries.push(l),
    setTimer: (fn, ms) => {
      const id = ++counter;
      timers.set(id, { fn, ms });
      return id;
    },
    clearTimer: (id) => timers.delete(id),
  });
  return {
    sync,
    disk,
    remote,
    calls,
    states,
    libraries,
    timers,
    setOnline: (v) => (online = v),
    runTimer: async () => {
      const [id, t] = [...timers][0];
      timers.delete(id);
      t.fn();
      await tick();
    },
  };
}
test("initial sign-in merges guest and remote without modifying guest; accounts remain isolated on logout/switch", async () => {
  const h = harness({ remote: { revision: 2, playlists: [p("cloud")] } });
  h.disk.setItem(GUEST_PLAYLIST_KEY, JSON.stringify([p("guest")]));
  h.sync.setAccount("A");
  await tick();
  assert.deepEqual(
    h.remote.playlists.map((x) => x.id),
    ["cloud", "guest"],
  );
  assert.deepEqual(JSON.parse(h.disk.getItem(GUEST_PLAYLIST_KEY)), [
    p("guest"),
  ]);
  writePlaylistLists(h.disk, playlistStorageKey("A"), [
    ...h.remote.playlists,
    p("privateA"),
  ]);
  h.sync.changed(playlistStorageKey("A"));
  h.sync.setAccount(null);
  assert.equal(h.libraries.at(-1).key, GUEST_PLAYLIST_KEY);
  h.setOnline(false);
  h.sync.setAccount("B");
  assert.deepEqual(
    readPlaylistCache(h.disk, playlistStorageKey("B")).playlists.map(
      (x) => x.id,
    ),
    ["guest"],
  );
  assert.ok(
    readPlaylistCache(h.disk, playlistStorageKey("A")).playlists.some(
      (x) => x.id === "privateA",
    ),
  );
  h.sync.dispose();
});
test("guest device deletion does not delete an account copy; remote deletion does not resurrect on later sign-ins", async () => {
  const h = harness();
  h.disk.setItem(GUEST_PLAYLIST_KEY, JSON.stringify([p("guest")]));
  h.sync.setAccount("A");
  await tick();
  h.sync.setAccount(null);
  h.disk.setItem(GUEST_PLAYLIST_KEY, "[]");
  h.sync.setAccount("A");
  await tick();
  assert.equal(h.remote.playlists.length, 1);
  h.sync.setAccount(null);
  h.remote.playlists = [];
  h.remote.revision++;
  h.sync.setAccount("A");
  await tick();
  assert.deepEqual(h.remote.playlists, []);
  h.sync.dispose();
});
test("offline edits persist through reload and retry automatically merges new remote work", async () => {
  const h = harness({ remote: { revision: 1, playlists: [p("a")] } });
  h.sync.setAccount("A");
  await tick();
  h.setOnline(false);
  writePlaylistLists(h.disk, playlistStorageKey("A"), [p("a", "edited")]);
  h.sync.changed(playlistStorageKey("A"));
  h.sync.dispose();
  const second = harness({
    disk: h.disk,
    remote: { revision: 2, playlists: [p("a"), p("remote-new")] },
    online: false,
  });
  second.sync.setAccount("A");
  assert.equal(second.states.at(-1).state, "offline");
  second.setOnline(true);
  second.sync.refresh();
  await tick();
  assert.deepEqual(
    second.remote.playlists.map((p) => p.name),
    ["edited", "remote-new"],
  );
  assert.equal(second.states.at(-1).state, "saved");
  second.sync.dispose();
});
test("three-way merges preserve deletion and conflict copies instead of silently losing track/name edits", () => {
  assert.deepEqual(
    mergePlaylistLibraries([p("a")], [], [p("a")]).playlists,
    [],
  );
  assert.deepEqual(
    mergePlaylistLibraries([p("a")], [p("a")], []).playlists,
    [],
  );
  const editDelete = mergePlaylistLibraries([p("a")], [p("a", "local")], []);
  assert.equal(editDelete.conflicts, 1);
  assert.equal(editDelete.playlists[0].name, "local (recovered edit)");
  const both = mergePlaylistLibraries(
    [p("a")],
    [p("a", "local", ["x"])],
    [p("a", "remote", ["y"])],
  );
  assert.equal(both.playlists.length, 2);
  assert.deepEqual(
    both.playlists.map((p) => p.recordIds),
    [["y"], ["x"]],
  );
  assert.ok(
    both.playlists.every((p) => p.id.length <= 100 && p.name.length <= 100),
  );
});
test("409 refresh merges a second device change and preserves both conflicting versions", async () => {
  let inject = false;
  const h = harness({
    remote: { revision: 1, playlists: [p("a")] },
    request: async (server, path, options) => {
      if (inject && options?.method === "PUT") {
        inject = false;
        h.remote.revision++;
        h.remote.playlists = [p("a", "other device")];
        throw Object.assign(Error("conflict"), { status: 409 });
      }
      return server(path, options);
    },
  });
  h.sync.setAccount("A");
  await tick();
  writePlaylistLists(h.disk, playlistStorageKey("A"), [p("a", "this device")]);
  inject = true;
  h.sync.changed(playlistStorageKey("A"));
  await h.runTimer();
  assert.equal(h.remote.playlists.length, 2);
  assert.match(h.states.at(-1).message, /preserved for review/);
  h.sync.dispose();
});
test("lost PUT acknowledgment with further local edits does not create a false conflict or resurrect deleted lists", async () => {
  let lose = false;
  const h = harness({
    remote: { revision: 1, playlists: [p("a"), p("delete-me")] },
    request: async (server, path, options) => {
      const result = await server(path, options);
      if (lose && options?.method === "PUT") {
        lose = false;
        writePlaylistLists(h.disk, playlistStorageKey("A"), [
          p("a", "after-send"),
        ]);
        throw Error("connection lost after write");
      }
      return result;
    },
  });
  h.sync.setAccount("A");
  await tick();
  writePlaylistLists(h.disk, playlistStorageKey("A"), [p("a", "sent")]);
  lose = true;
  h.sync.changed(playlistStorageKey("A"));
  await h.runTimer();
  assert.equal(h.states.at(-1).state, "retry");
  h.sync.retry();
  await tick();
  assert.deepEqual(h.remote.playlists, [p("a", "after-send")]);
  assert.equal(h.states.at(-1).message, "Saved to your Music Nerd account.");
  h.sync.dispose();
});
test("late old-account responses cannot apply to a new account or replace guest lists", async () => {
  let resolve;
  const h = harness({
    request: () =>
      new Promise((r) => {
        resolve = r;
      }),
  });
  h.disk.setItem(GUEST_PLAYLIST_KEY, JSON.stringify([p("guest")]));
  h.sync.setAccount("A");
  h.sync.setAccount(null);
  resolve({ revision: 3, playlists: [p("private")] });
  await tick();
  assert.equal(h.libraries.at(-1).accountId, null);
  assert.deepEqual(JSON.parse(h.disk.getItem(GUEST_PLAYLIST_KEY)), [
    p("guest"),
  ]);
  h.sync.dispose();
});
test("disabled backend never reports saving/saved or makes requests; malformed nested cache is retained", async () => {
  const h = harness();
  h.sync.setAccount("A", { syncEnabled: false });
  h.sync.changed(playlistStorageKey("A"));
  await tick();
  assert.equal(h.states.at(-1).state, "disabled");
  assert.equal(h.calls.length, 0);
  h.sync.dispose();
  const broken = harness();
  const key = playlistStorageKey("B");
  broken.disk.setItem(key, JSON.stringify({ playlists: [], base: "corrupt" }));
  broken.sync.setAccount("B");
  await tick();
  assert.equal(broken.calls.length, 0);
  assert.match(broken.disk.getItem(key), /corrupt/);
  assert.equal(broken.states.at(-1).state, "retry");
  broken.sync.dispose();
});

test("unchanged guest list cannot resurrect an account deletion at next sign-in", async () => {
  const h = harness();
  h.disk.setItem(GUEST_PLAYLIST_KEY, JSON.stringify([p("guest")]));
  h.sync.setAccount("A");
  await tick();
  h.sync.setAccount(null);
  h.remote.playlists = [];
  h.remote.revision++;
  h.sync.setAccount("A");
  await tick();
  assert.deepEqual(h.remote.playlists, []);
  assert.equal(JSON.parse(h.disk.getItem(GUEST_PLAYLIST_KEY)).length, 1);
  h.sync.dispose();
});
test("corrupt local library remains readable as an error state and all writes are blocked", async () => {
  const { createPlaylistStore } = await import("../src/personal-playlists.mjs");
  const disk = storage();
  disk.setItem(GUEST_PLAYLIST_KEY, "{broken");
  const store = createPlaylistStore(disk);
  assert.deepEqual(store.all(), []);
  assert.match(store.error(), /not been overwritten/);
  assert.throws(() => store.create("Do not overwrite"));
  assert.equal(disk.getItem(GUEST_PLAYLIST_KEY), "{broken");
});
