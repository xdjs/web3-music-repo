export function musicFacts(record) {
  const notes = String(record.note || "");
  const tempoValues = [
    ...notes.matchAll(
      /^\s*(?:bpm\s*:?\s*(\d{2,3}(?:\.\d+)?)|(\d{2,3}(?:\.\d+)?)\s*bpm)\s*[.!]?\s*$/gim,
    ),
  ].map((m) => Number(m[1] || m[2]));
  for (const match of String(record.title || "").matchAll(
    /\((\d{2,3}(?:\.\d+)?)\s*BPM\)/gi,
  ))
    tempoValues.push(Number(match[1]));
  const tempos = [...new Set(tempoValues.filter((n) => n >= 20 && n <= 400))];
  const keys = [
    ...new Set(
      [
        ...notes.matchAll(
          /^\s*key\s*:\s*([A-G](?:#|b)?)\s*(major|minor|maj|min)\s*[.!]?\s*$/gim,
        ),
      ].map(
        (m) =>
          m[1][0].toUpperCase() +
          m[1].slice(1) +
          " " +
          (m[2].toLowerCase().startsWith("maj") ? "major" : "minor"),
      ),
    ),
  ];
  const original = record.musicMetadata;
  const metadataBpm =
    original?.bpms?.length === 1
      ? original.bpms[0]
      : tempos.length === 1
        ? tempos[0]
        : null;
  const estimated =
    !metadataBpm &&
    record.audioAnalysis?.status === "estimated" &&
    Number.isFinite(record.audioAnalysis.bpm);

  return {
    bpm:
      metadataBpm ||
      (estimated ? Math.round(record.audioAnalysis.bpm * 10) / 10 : null),
    key:
      original?.keys?.length === 1
        ? original.keys[0]
        : keys.length === 1
          ? keys[0]
          : null,
    source: estimated
      ? "BPM estimated by Open BPM; tempo may be half or double. Key, when shown, comes from release metadata."
      : original && (original.bpms.length || original.keys.length)
        ? "Original token metadata; not audio-analysis estimates"
        : "Release notes; not audio-analysis estimates",
  };
}
