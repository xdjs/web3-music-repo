import { musicFacts } from "./music-facts.mjs";
export function parseBpmBound(value) {
  if (value === "" || value === undefined || value === null) return "";
  if (
    typeof value !== "string" ||
    !/^\d{1,3}(?:\.\d{1,3})?$/.test(value.trim())
  )
    return null;
  const bpm = Number(value);
  return Number.isFinite(bpm) && bpm >= 20 && bpm <= 400 ? String(bpm) : null;
}
export function normalizeBpmRange(min = "", max = "") {
  const lo = parseBpmBound(min),
    hi = parseBpmBound(max);
  if (lo === null || hi === null) return null;
  return lo !== "" && hi !== "" && Number(lo) > Number(hi)
    ? { bpmMin: hi, bpmMax: lo, reordered: true }
    : { bpmMin: lo, bpmMax: hi, reordered: false };
}
export function recordBpm(record) {
  const facts = record.musicFacts || musicFacts(record);
  return typeof facts.bpm === "number" &&
    Number.isFinite(facts.bpm) &&
    facts.bpm > 0
    ? facts.bpm
    : null;
}
export function bpmControlsActive(facets) {
  return Boolean(
    facets.bpmMin ||
    facets.bpmMax ||
    ["bpm-asc", "bpm-desc"].includes(facets.sort),
  );
}
export function filterAndSortBpm(records, facets) {
  const range = normalizeBpmRange(facets.bpmMin, facets.bpmMax);
  const active = range && (range.bpmMin !== "" || range.bpmMax !== "");
  const tempos = new Map();
  const tempo = (record) => {
    if (!tempos.has(record)) tempos.set(record, recordBpm(record));
    return tempos.get(record);
  };
  const list = active
    ? records.filter((record) => {
        const bpm = tempo(record);
        return (
          bpm !== null &&
          (range.bpmMin === "" || bpm >= Number(range.bpmMin)) &&
          (range.bpmMax === "" || bpm <= Number(range.bpmMax))
        );
      })
    : [...records];
  if (["bpm-asc", "bpm-desc"].includes(facets.sort)) {
    const direction = facets.sort === "bpm-asc" ? 1 : -1;
    list.sort((a, b) => {
      const left = tempo(a),
        right = tempo(b);
      if (left === null && right !== null) return 1;
      if (right === null && left !== null) return -1;
      return (
        (left !== null && right !== null ? direction * (left - right) : 0) ||
        String(a.id).localeCompare(String(b.id))
      );
    });
  }
  return list;
}
export function bpmTag(record) {
  const facts = record.musicFacts || musicFacts(record),
    bpm = recordBpm(record);
  return bpm === null
    ? null
    : {
        text: `${facts.source?.startsWith("BPM estimated") ? "~" : ""}${bpm} BPM`,
        source: facts.source || "Tempo preserved with this recording",
      };
}
