export const LYRICS_BYTE_LIMIT = 100 * 1024;
export function extractLyrics(metadata) {
  const roots = [
    [metadata, "lyrics"],
    [metadata?.body, "body.lyrics"],
    [metadata?.properties, "properties.lyrics"],
  ];
  const lyrics = [],
    references = [],
    seen = new Set();
  let bytes = 0,
    tooLarge = false;
  for (const [root, field] of roots) {
    const raw =
      typeof root?.lyrics === "string" ? root.lyrics : root?.lyrics?.text;
    if (typeof raw !== "string") continue;
    const text = raw
      .replace(/\r\n?/g, "\n")
      .replace(/\u0000/g, "")
      .trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    if (text.length > LYRICS_BYTE_LIMIT) {
      tooLarge = true;
      continue;
    }
    if (/^(?:(?:https?:|ipfs:|ar:)\/\/|www\.|\/\/)\S+$/i.test(text)) {
      if (text.length <= 4096) references.push({ url: text, field });
      else tooLarge = true;
      continue;
    }
    if (
      /^(?:n\/?a|none|null|undefined|false|true|no lyrics(?: available)?|lyrics (?:unavailable|not available)|not available|instrumental|\[instrumental\]|tba|tbd)$/i.test(
        text,
      )
    )
      continue;
    const size = new TextEncoder().encode(text).byteLength;
    if (size + bytes > LYRICS_BYTE_LIMIT) {
      tooLarge = true;
      continue;
    }
    lyrics.push({ text, field });
    bytes += size;
  }
  return {
    ...(lyrics.length ? { hasLyrics: true, lyrics } : {}),
    ...(references.length ? { lyricsReferences: references } : {}),
    ...(tooLarge ? { lyricsOmittedReason: "text-exceeds-100kb-limit" } : {}),
  };
}

export function extractMusicMetadata(metadata) {
  const roots = [metadata, metadata?.body, metadata?.properties].filter(
    (x) => x && typeof x === "object",
  );
  const bpms = [],
    keys = [],
    collaborators = [],
    credits = [],
    details = {};
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
    for (const [key, value] of Object.entries(root)) add(key, value);
    if (typeof root.project?.title === "string")
      add("project", root.project.title);
    for (const trait of Array.isArray(root.attributes) ? root.attributes : [])
      add(trait.trait_type || trait.name || "", trait.value);
    for (const key of ["collaborators", "credits"]) {
      if (Array.isArray(root[key]))
        for (const item of root[key]) {
          if (typeof item === "string") add(key, item);
          else if (
            item &&
            typeof item.name === "string" &&
            typeof (item.role || item.collaboratorType) === "string"
          )
            add(key, `${item.name} — ${item.role || item.collaboratorType}`);
        }
    }
  }
  return {
    ...extractLyrics(metadata),
    bpms: [...new Set(bpms)],
    keys: [...new Set(keys)],
    collaborators: [...new Set(collaborators)],
    credits: [...new Set(credits)],
    details: Object.fromEntries(
      Object.entries(details).map(([k, v]) => [k, [...new Set(v)]]),
    ),
  };
}
