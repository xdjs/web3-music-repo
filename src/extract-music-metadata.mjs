export function extractMusicMetadata(metadata) {
  const roots = [metadata, metadata?.body, metadata?.properties].filter(
    (x) => x && typeof x === "object",
  );
  const bpms = [],
    keys = [],
    collaborators = [],
    credits = [],
    details = {};
  let hasLyrics = false;
  const add = (key, value) => {
    if (typeof value !== "string" && typeof value !== "number") return;
    const text = String(value).trim();
    if (!text || text.length > 10000) return;
    key = key.toLowerCase().replace(/[ _-]/g, "");
    const labels = {
      genre: "Genre",
      genres: "Genre",
      mood: "Mood",
      instrument: "Instruments",
      instruments: "Instruments",
      language: "Language",
      isrc: "ISRC",
      license: "License",
      recordlabel: "Record label",
      publisher: "Publisher",
      locationcreated: "Recorded in",
      originalreleasedate: "Original release",
      releasedate: "Release date",
      project: "Project",
      album: "Album",

      description: "Description",
      notes: "Description",
      duration: "Duration",
      tracknumber: "Track number",
    };
    if (labels[key]) {
      if (
        key === "duration" &&
        (!Number.isFinite(Number(text)) || Number(text) <= 0)
      )
        return;
      (details[labels[key]] ||= []).push(text);
    }
    if (
      ["bpm", "tempo"].includes(key) &&
      /^\d{2,3}(?:\.\d+)?$/.test(text) &&
      Number(text) >= 20 &&
      Number(text) <= 400
    )
      bpms.push(Number(text));
    const keyText = text
      .replace(/_SHARP_/g, "# ")
      .replace(/_FLAT_/g, "b ")
      .replace(/_/g, " ");
    if (
      ["key", "musicalkey", "musickey", "keysig", "keysignature"].includes(
        key,
      ) &&
      /^[A-G](?:#|b|♭|♯)?\s*(?:major|minor|maj|min|m)?$/i.test(keyText)
    )
      keys.push(keyText);
    if (["collaborators", "collaborator"].includes(key))
      collaborators.push(text);
    if (["songcredits", "credits"].includes(key)) credits.push(text);
  };
  for (const root of roots) {
    if (
      (typeof root.lyrics === "string" && root.lyrics.trim()) ||
      (typeof root.lyrics?.text === "string" && root.lyrics.text.trim())
    )
      hasLyrics = true;
    for (const [key, value] of Object.entries(root)) add(key, value);
    for (const trait of Array.isArray(root.attributes) ? root.attributes : [])
      add(trait.trait_type || trait.name || "", trait.value);
    for (const key of ["collaborators", "credits"]) {
      if (Array.isArray(root[key]))
        for (const item of root[key]) {
          if (typeof item === "string") add(key, item);
          else if (
            item &&
            typeof item.name === "string" &&
            typeof item.role === "string"
          )
            add(key, `${item.name} — ${item.role}`);
        }
    }
  }
  return {
    ...(hasLyrics ? { hasLyrics: true } : {}),
    bpms: [...new Set(bpms)],
    keys: [...new Set(keys)],
    collaborators: [...new Set(collaborators)],
    credits: [...new Set(credits)],
    details: Object.fromEntries(
      Object.entries(details).map(([k, v]) => [k, [...new Set(v)]]),
    ),
  };
}
