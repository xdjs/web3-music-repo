// Choose once per page visit. UI rerenders must not replace a song under the listener.
export function createHomeSelection(storage, random = Math.random) {
  let selected;
  const shuffle = (items) => {
    const copy = [...new Set(items)];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  return (heroIds, artistIds) => {
    if (selected) return selected;
    let previous = {};
    try {
      previous =
        JSON.parse(storage?.getItem("mn-home-selection") || "{}") || {};
    } catch {}
    const alternatives = heroIds.filter((id) => id !== previous.heroId);
    const previousArtists = Array.isArray(previous.artistIds)
      ? previous.artistIds
      : [];
    const freshArtists = artistIds.filter(
      (id) => !previousArtists.includes(id),
    );
    selected = {
      heroId: shuffle(alternatives.length ? alternatives : heroIds)[0],
      artistIds: [
        ...shuffle(freshArtists),
        ...shuffle(artistIds.filter((id) => !freshArtists.includes(id))),
      ].slice(0, 7),
    };
    try {
      storage?.setItem("mn-home-selection", JSON.stringify(selected));
    } catch {}
    return selected;
  };
}
