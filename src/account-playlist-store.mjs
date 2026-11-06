import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
export function createAccountPlaylistStore(root) {
  const locks = new Map();
  const file = (id) => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw Error("Invalid account");
    return path.join(root, id + ".json");
  };
  const read = async (id) => {
    try {
      return JSON.parse(await readFile(file(id), "utf8"));
    } catch (e) {
      if (e.code === "ENOENT") return { revision: 0, playlists: [] };
      throw e;
    }
  };
  return {
    read,
    write: async (id, revision, playlists) => {
      const prior = locks.get(id) || Promise.resolve();
      const work = prior
        .catch(() => {})
        .then(async () => {
          const current = await read(id);
          if (current.revision !== revision)
            return { conflict: true, ...current };
          await mkdir(root, { recursive: true, mode: 0o700 });
          const next = {
            revision: revision + 1,
            playlists,
            updatedAt: new Date().toISOString(),
          };
          await writeFile(file(id) + ".tmp", JSON.stringify(next), {
            mode: 0o600,
          });
          await rename(file(id) + ".tmp", file(id));
          return next;
        });
      locks.set(id, work);
      try {
        return await work;
      } finally {
        if (locks.get(id) === work) locks.delete(id);
      }
    },
  };
}
