import { compareReleaseDates } from "./release-date.mjs";

export function collectionSelect(
  esc,
  name,
  label,
  choices,
  value = "",
  attribute = "data-facet",
) {
  return `<label class="filter-control"><span>${label}</span><select ${attribute}="${name}" aria-label="${label}">${choices.map(([key, text]) => `<option value="${esc(key)}" ${String(value) === String(key) ? "selected" : ""}>${esc(text)}</option>`).join("")}</select></label>`;
}

export function filterCollectionRecords(
  records,
  filters,
  platform = (r) => r.platform || "",
) {
  const query = (filters.query || "").trim().toLowerCase();
  const list = records.filter(
    (r) =>
      (!filters.platform || platform(r) === filters.platform) &&
      (!filters.network || String(r.chainId) === filters.network) &&
      (!filters.media || r.kind === filters.media) &&
      (!filters.collection || r.collection === filters.collection) &&
      (!query ||
        [r.title, r.artist, r.collection, r.searchCredits]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query)),
  );
  if (["oldest", "newest"].includes(filters.sort))
    list.sort((a, b) => compareReleaseDates(a, b, filters.sort));
  else if (["title", "artist"].includes(filters.sort))
    list.sort(
      (a, b) =>
        String(a[filters.sort] || "").localeCompare(
          String(b[filters.sort] || ""),
        ) || a.id.localeCompare(b.id),
    );
  return list;
}
