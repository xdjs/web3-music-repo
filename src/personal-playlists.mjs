const KEY = "mn-archive-playlists-v1";
export function createPlaylistStore(storage) {
  let lists = [];
  try {
    const v = JSON.parse(storage.getItem(KEY) || "[]");
    if (Array.isArray(v))
      lists = v
        .filter(
          (p) =>
            typeof p.id === "string" &&
            typeof p.name === "string" &&
            Array.isArray(p.recordIds),
        )
        .map((p) => ({
          ...p,
          recordIds: p.recordIds.filter((id) => typeof id === "string"),
        }));
  } catch {}
  const save = (next) => {
    storage.setItem(KEY, JSON.stringify(next));
    lists = next;
  };
  return {
    all: () => structuredClone(lists),
    create(name, recordId) {
      name = name.trim().slice(0, 100);
      if (!name) throw Error("Give your playlist a name.");
      const p = {
        id: crypto.randomUUID(),
        name,
        recordIds: recordId ? [recordId] : [],
        createdAt: new Date().toISOString(),
      };
      save([...lists, p]);
      return p.id;
    },
    update(id, fn) {
      save(
        lists.map((p) =>
          p.id === id
            ? { ...fn(structuredClone(p)), updatedAt: new Date().toISOString() }
            : p,
        ),
      );
    },
    remove(id) {
      save(lists.filter((p) => p.id !== id));
    },
  };
}
export function mountPlaylists({
  catalog,
  esc,
  image,
  play,
  notify,
  rerender,
}) {
  let storage;
  try {
    storage = localStorage;
  } catch {
    storage = {
      getItem: () => null,
      setItem: () => {
        throw Error("Browser storage unavailable");
      },
    };
  }
  const store = createPlaylistStore(storage);
  const dialog = document.createElement("dialog");
  dialog.id = "playlist-editor";
  document.body.append(dialog);
  const close = () => dialog.close();
  const commit = (fn) => {
    try {
      fn();
      close();
      rerender();
      return true;
    } catch {
      notify(
        "Could not save. Browser storage may be full or disabled. Your saved playlists have not been changed.",
      );
      return false;
    }
  };
  const openEditor = (recordId = null, id = null) => {
    const p = store.all().find((p) => p.id === id);
    dialog.innerHTML = `<form><div class="dialog-title"><h2>${recordId ? "Add to a playlist" : p ? "Rename playlist" : "New playlist"}</h2><button type="button" class="icon" data-cancel aria-label="Close playlist editor">×</button></div>${
      recordId && store.all().length
        ? `<label class="form-label">Choose a playlist<select name="existing"><option value="">Create a new playlist</option>${store
            .all()
            .map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`)
            .join("")}</select></label>`
        : ""
    }<label class="form-label" id="playlist-name-field">Playlist name<input name="name" placeholder="Late nights, early records…" maxlength="100" value="${esc(p?.name || "")}" required></label><p class="link-note">Saved on this device. Sign in and use My profile to save or load your account library.</p><div class="actions"><button type="submit" class="primary">${recordId ? "Add recording" : "Save playlist"}</button><button type="button" class="outline-button" data-cancel>Cancel</button></div></form>`;
    dialog
      .querySelectorAll("[data-cancel]")
      .forEach((b) => (b.onclick = close));
    const form = dialog.querySelector("form"),
      select = form.elements.existing;
    select?.addEventListener("change", () => {
      form.elements.name.required = !select.value;
      dialog.querySelector("#playlist-name-field").hidden = !!select.value;
    });
    form.onsubmit = (e) => {
      e.preventDefault();
      let target = id;
      if (
        commit(() => {
          if (select?.value) {
            target = select.value;
            store.update(target, (p) => ({
              ...p,
              recordIds: p.recordIds.includes(recordId)
                ? p.recordIds
                : [...p.recordIds, recordId],
            }));
          } else if (id) {
            store.update(id, (p) => ({
              ...p,
              name: form.elements.name.value.trim().slice(0, 100),
            }));
          } else target = store.create(form.elements.name.value, recordId);
        })
      ) {
        notify(recordId ? "Recording saved to playlist" : "Playlist saved");
        if (!recordId) location.hash = "playlist/" + target;
      }
    };
    dialog.showModal();
  };
  const row = (p, id, i) => {
    const r = catalog().find((r) => r.id === id);
    return `<div class="track-row personal-track"><span class="index">${i + 1}</span>${r ? `<img src="${esc(image(r))}" alt=""><div><a href="#record/${esc(r.id)}"><strong>${esc(r.title.replace(/\s*#\d+$/, ""))}</strong></a><small>${esc(r.artist)}</small></div>` : `<div><strong>Recording unavailable in this catalog</strong><small>${esc(id)}</small></div>`}<div class="playlist-track-actions">${r ? `<button class="icon" data-personal-track="${p.id}" data-index="${i}" aria-label="Play ${esc(r.title)}">▶</button>` : ""}<button class="icon" data-move-track="${p.id}" data-index="${i}" data-direction="-1" aria-label="Move track ${i + 1} up" ${i === 0 ? "disabled" : ""}>↑</button><button class="icon" data-move-track="${p.id}" data-index="${i}" data-direction="1" aria-label="Move track ${i + 1} down" ${i === p.recordIds.length - 1 ? "disabled" : ""}>↓</button><button class="icon" data-remove-track="${p.id}" data-index="${i}" aria-label="Remove track ${i + 1}">×</button></div></div>`;
  };
  const view = (id, embedded = false) => {
    if (id) {
      const p = store.all().find((p) => p.id === id);
      if (!p)
        return '<h1>Playlist not found</h1><a href="#playlists">Your playlists</a>';
      return `<a class="back" href="#playlists">← Your playlists</a><div class="intro"><div><span class="eyebrow">YOUR PLAYLIST · SAVED ON THIS DEVICE</span><h1>${esc(p.name)}</h1><p>${p.recordIds.length} recordings · your own piece of the era</p></div></div><div class="actions playlist-actions"><button class="primary" data-play-personal="${p.id}" ${p.recordIds.length ? "" : "disabled"}>▶ Play playlist</button><button class="outline-button" data-rename-playlist="${p.id}">Rename</button><button class="outline-button" data-export-playlist="${p.id}">↓ Export</button><button class="text-button" data-delete-playlist="${p.id}">Delete playlist</button></div>${p.recordIds.length ? p.recordIds.map((id, i) => row(p, id, i)).join("") : '<div class="empty">Your first track is waiting. <a class="error-link" href="#explore">Explore music ↗</a><p>Open a recording and choose “Add to playlist”.</p></div>'}`;
    }
    return `<div class="intro"><div>${embedded ? "<h2>My playlists</h2>" : "<h1>Your playlists</h1>"}<p>Bring the records back together. Make a soundtrack of your own.</p></div><button class="primary" data-new-playlist>＋ New playlist</button></div><p class="link-note">Saved in this browser. Export a copy or use My profile to save and load your account library.</p><div class="personal-playlist-grid">${
      store
        .all()
        .map(
          (p) =>
            `<a class="personal-playlist-card" href="#playlist/${p.id}"><div class="playlist-cover">${
              p.recordIds.length
                ? p.recordIds
                    .slice(0, 4)
                    .map((id) => catalog().find((r) => r.id === id))
                    .filter(Boolean)
                    .map((r) => `<img src="${esc(image(r))}" alt="">`)
                    .join("")
                : "<span>☷</span>"
            }</div><h2>${esc(p.name)}</h2><p>${p.recordIds.length} recordings</p></a>`,
        )
        .join("") ||
      '<div class="empty">Create a playlist, then add recordings from their release pages.</div>'
    }</div><a class="archive-callout" href="#historic-playlists"><div class="archive-symbol">☷</div><div><h3>Playlists from the era</h3><p>Explore Chill n Work, preserved from Sound’s January 2023 pages.</p></div><span>Explore ↗</span></a><a class="text-button" href="#liked">♡ Your liked sounds</a>`;
  };
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const d = b.dataset;
    if ("newPlaylist" in d) openEditor();
    if (d.addPlaylist) openEditor(d.addPlaylist);
    if (d.renamePlaylist) openEditor(null, d.renamePlaylist);
    if (d.playPersonal || d.personalTrack) {
      const p = store
        .all()
        .find((p) => p.id === (d.playPersonal || d.personalTrack));
      const ids = p.recordIds.filter((id) =>
        catalog().some((r) => r.id === id),
      );
      const start = d.personalTrack
        ? ids.indexOf(p.recordIds[Number(d.index)])
        : 0;
      if (ids.length && start >= 0) play(ids[start], ids, start);
      else notify("These recordings are not available in this catalog.");
    }
    if (d.moveTrack)
      commit(() =>
        store.update(d.moveTrack, (p) => {
          const i = Number(d.index),
            j = i + Number(d.direction);
          if (j >= 0 && j < p.recordIds.length)
            [p.recordIds[i], p.recordIds[j]] = [p.recordIds[j], p.recordIds[i]];
          return p;
        }),
      );
    if (d.removeTrack)
      commit(() =>
        store.update(d.removeTrack, (p) => ({
          ...p,
          recordIds: p.recordIds.filter((_, i) => i !== Number(d.index)),
        })),
      );
    if (d.deletePlaylist) {
      dialog.innerHTML =
        '<h2>Delete this playlist?</h2><p class="link-note">This removes the saved list from this device. The recordings remain in the archive.</p><div class="actions"><button class="primary" id="confirm-delete">Delete playlist</button><button class="outline-button" id="cancel-delete">Keep playlist</button></div>';
      dialog.querySelector("#cancel-delete").onclick = close;
      dialog.querySelector("#confirm-delete").onclick = () => {
        if (commit(() => store.remove(d.deletePlaylist)))
          location.hash = "playlists";
      };
      dialog.showModal();
    }
    if (d.exportPlaylist) {
      const p = store.all().find((p) => p.id === d.exportPlaylist);
      const data = {
        schema: "music-nerd-playlist/v1",
        ...p,
        tracks: p.recordIds.map((id) => {
          const r = catalog().find((r) => r.id === id);
          return r
            ? {
                id,
                artist: r.artist,
                title: r.title,
                chainId: r.chainId,
                contract: r.contract,
                tokenId: r.tokenId,
              }
            : { id };
        }),
      };
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = p.name.replace(/[^a-z0-9-]/gi, "_") + ".json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  });
  return { view };
}
