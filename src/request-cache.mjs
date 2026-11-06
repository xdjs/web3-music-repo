// Share an in-flight upstream read; retain only successful results, with a bounded cache.
export function createReadCache({
  ttl = 300000,
  limit = 256,
  now = Date.now,
} = {}) {
  const values = new Map(),
    pending = new Map();
  return async function read(key, loader) {
    const hit = values.get(key);
    if (hit && now() - hit.time < ttl) return hit.value;
    if (pending.has(key)) return pending.get(key);
    const request = Promise.resolve()
      .then(loader)
      .then((value) => {
        if (value.status === "live") {
          values.delete(key);
          values.set(key, { time: now(), value });
          while (values.size > limit) values.delete(values.keys().next().value);
        }
        return value;
      })
      .finally(() => pending.delete(key));
    pending.set(key, request);
    return request;
  };
}
