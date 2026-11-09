import { normalizeBpmRange } from "./bpm-filter.mjs";
const KEYS = Object.freeze({
  explore: "mn-archive-explore-filters-v1",
  collection: "mn-archive-collection-filters-v1",
});
const defaults = (scope) => ({
  platform: scope === "explore" ? "All" : "",
  network: "",
  media: "",
  collection: "",
  sort: "archive",
  ...(scope === "explore" ? { bpmMin: "", bpmMax: "" } : {}),
});

// Only named public catalog facets are eligible. Queries, wallet addresses and
// signed-in ownership scope are deliberately outside this storage contract.
export function createFilterPreferences(
  scope,
  { storage = () => globalThis.localStorage, choices = () => ({}) } = {},
) {
  if (!Object.hasOwn(KEYS, scope)) throw new Error("Unknown filter scope");
  const key = KEYS[scope];
  function validate(value) {
    const result = defaults(scope);
    if (!value || typeof value !== "object" || Array.isArray(value))
      return result;
    const allowed = {
      ...choices(),
      media: ["", "audio", "video"],
      sort: [
        "archive",
        "title",
        "artist",
        "newest",
        "oldest",
        ...(scope === "explore" ? ["bpm-asc", "bpm-desc"] : []),
      ],
    };
    for (const field of Object.keys(result)) {
      const input = value[field];
      if (
        typeof input === "string" &&
        input.length <= 500 &&
        (input === result[field] ||
          (allowed[field] || []).some((option) => String(option) === input))
      )
        result[field] = input;
    }
    if (scope === "explore") {
      const range = normalizeBpmRange(value.bpmMin, value.bpmMax);
      if (range) {
        result.bpmMin = range.bpmMin;
        result.bpmMax = range.bpmMax;
      }
    }
    return result;
  }
  return {
    key,
    load() {
      try {
        const raw = storage()?.getItem(key);
        if (!raw || raw.length > 4000) return defaults(scope);
        const saved = JSON.parse(raw);
        return saved.version === 1 ? validate(saved.values) : defaults(scope);
      } catch {
        return defaults(scope);
      }
    },
    save(value) {
      const values = validate(value);
      try {
        storage()?.setItem(key, JSON.stringify({ version: 1, values }));
      } catch {}
      return values;
    },
    reset() {
      try {
        storage()?.removeItem(key);
      } catch {}
      return defaults(scope);
    },
  };
}
