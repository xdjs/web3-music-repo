import { extractMusicMetadata } from "./extract-music-metadata.mjs";
export const SUPER_SOURCE =
  "https://release.supercollector.xyz/api/releases/search";
const https = (v) => {
  try {
    const u = new URL(v);
    return u.protocol === "https:" && !u.username && !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
};
const ipfs = (v) =>
  typeof v === "string" &&
  /^ipfs:\/\/(?:Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,})(?:\/[^\s?#]*)?$/.test(
    v,
  )
    ? v
    : null;
const media = (v) =>
  v
    ? {
        cid: ipfs(v.cid),
        url: https(v.url),
        type: typeof v.type === "string" ? v.type : null,
        duration: Number.isFinite(v.duration) ? v.duration : null,
      }
    : null;
const gateway = (v) =>
  ipfs(v) ? `https://ipfs.supercollector.xyz/ipfs/${v.slice(7)}` : null;
const metadata = (v) => {
  const out = {};
  for (const k of [
    "bpm",
    "key",
    "isrc",
    "artist",
    "license",
    "explicit",
    "recordLabel",
    "release_upc",
    "featuredArtists",
    "genre",
    "genres",
    "description",
    "upc",
  ])
    if (
      ["string", "boolean", "number"].includes(typeof v?.[k]) ||
      (Array.isArray(v?.[k]) && v[k].every((x) => typeof x === "string"))
    )
      out[k] = v[k];
  if (Array.isArray(v?.credits))
    out.credits = v.credits
      .filter((c) => typeof c.credit === "string")
      .map((c) => ({
        name: c.credit,
        role: typeof c.type === "string" ? c.type : "credit",
      }));
  return out;
};
export function sanitizeSuperRelease(release, index, checkedAt, sourceHash) {
  if (
    !release ||
    release.id !== index.id ||
    release.address?.toLowerCase() !== index.address?.toLowerCase()
  )
    throw Error("Release identity mismatch");
  if (!Number.isSafeInteger(release.chain_id) || release.chain_id <= 0)
    throw Error("Release chain not explicit");
  return {
    id: release.id,
    name: release.name,
    artist: release.artist,
    slug: index.slug,
    address: release.address.toLowerCase(),
    chainId: release.chain_id,
    releaseDate: release.release_date,
    contractURI: ipfs(index.contract_uri),
    metadataURI: ipfs(index.metadata_uri),
    image: media(release.artwork),
    description: typeof release.info === "string" ? release.info : null,
    metadata: metadata(release.additional_metadata),
    artists: (release.release_artists || []).map((x) => ({
      name: x.artist?.name,
      slug: x.artist?.slug,
      links: (x.artist?.links || [])
        .map((l) => ({ label: l.label, url: https(l.link) }))
        .filter((l) => l.url),
    })),
    source: `https://release.supercollector.xyz/${index.slug}`,
    checkedAt,
    sourceSHA256: sourceHash,
    tracks: release.tracks.map((t) => {
      const indexed = index.tracks.find((x) => x.id === t.id);
      if (!indexed || indexed.number !== t.number)
        throw Error("Track identity mismatch");
      const open =
        t.gatekeep === false &&
        t.gatekeep_mode === "allow_all" &&
        t.released === true;
      return {
        id: t.id,
        number: t.number,
        name: t.name,
        released: t.released === true,
        gatekeep: t.gatekeep,
        gatekeepMode: t.gatekeep_mode,
        access: open ? "public" : "restricted-or-unconfirmed",
        metadataURI: open ? ipfs(indexed.metadata_uri) : null,
        image: media(t.artwork),
        audio: open ? media(t.audio) : null,
        encodedAudio: open ? media(t.encoded_audio) : null,
        metadata: metadata(t.additional_metadata),
      };
    }),
  };
}
export function supercollectorCredits(release, track) {
  const allowed = new Set([
    "ab4000e7-ce4f-40f8-ac27-47f9e780dfcf",
    "d3d65bfb-3d34-4769-b614-7f8be3c6e142",
    "3285a64f-9634-442d-919f-41db53ca6b27",
  ]);
  if (
    release.id !== "86cd0b02-0e7e-4daa-96b2-443db45447eb" ||
    release.address !== "0x0b0abf42c6cd9eb5803e39988850df4756a07956" ||
    release.chainId !== 10 ||
    !allowed.has(track.id)
  )
    return [];
  const roles = new Set(
    (track.metadata.credits || [])
      .filter(
        (c) =>
          c.name === "Peter Arango" && ["Producer", "Writer"].includes(c.role),
      )
      .map((c) => c.role),
  );
  return [...roles].map((role) => ({
    personId: "pete-rango",
    role,
    creditedName: "Peter Arango",
    source: release.source,
  }));
}
export function supercollectorBundle(releases, checkedAt, chainAudit = null) {
  const records = [],
    evidence = {},
    unresolved = [],
    identities = new Set();
  for (const r of releases)
    for (const t of r.tracks) {
      const key = `${r.chainId}:${r.address}:${t.number}`;
      if (
        !/^0x[a-f0-9]{40}$/.test(r.address) ||
        !Number.isSafeInteger(t.number) ||
        t.number < 0 ||
        identities.has(key)
      )
        throw Error("Duplicate or invalid token identity");
      identities.add(key);
      if (t.access !== "public") {
        unresolved.push({
          releaseId: r.id,
          trackId: t.id,
          reason: "restricted-or-unconfirmed",
        });
        continue;
      }
      if (!t.metadataURI || !t.metadataURI.endsWith(`/${t.number}.json`)) {
        unresolved.push({
          releaseId: r.id,
          trackId: t.id,
          reason: "metadata-token-number-unconfirmed",
        });
        continue;
      }
      const chosen = t.encodedAudio || t.audio,
        mediaURI = chosen?.cid,
        mediaURL = chosen?.url || gateway(mediaURI);
      if (!mediaURI || !mediaURL || !/^audio\//.test(chosen?.type || "")) {
        unresolved.push({
          releaseId: r.id,
          trackId: t.id,
          reason: "public-audio-reference-unavailable",
        });
        continue;
      }
      const id = `supercollector-${r.chainId}-${r.address.slice(2)}-${t.number}`;
      const normalized = {
        ...r.metadata,
        ...t.metadata,
        title: t.name,
        artist: t.metadata.artist || r.artist,
        project: { title: r.name },
        credits: [...(r.metadata.credits || []), ...(t.metadata.credits || [])],
        duration: chosen.duration,
      };
      records.push({
        id,
        chainId: r.chainId,
        standard: "ERC1155",
        contract: r.address,
        tokenId: String(t.number),
        platform: "Supercollector",
        kind: "audio",
        title: t.name,
        artist: normalized.artist,
        credits: supercollectorCredits(r, t),
        collaborators:
          t.metadata.featuredArtists || r.metadata.featuredArtists || [],
        imageURI: t.image?.cid || r.image?.cid,
        note:
          t.metadata.description ||
          r.metadata.description ||
          r.description ||
          "",
        originalRelease: r.source,
        platformReleaseId: r.id,
        platformTrackId: t.id,
        releaseTitle: r.name,
        releaseTrackNumber: t.number,
        artistReleaseDate: r.releaseDate,
        musicMetadata: {
          status: "read",
          schemaVersion: 4,
          source: r.source,
          sourceType: "official-public-release-page",
          recoveredAt: checkedAt,
          ...extractMusicMetadata(normalized),
        },
      });
      const chainRead = chainAudit?.results?.find(
        (x) => x.key === `${r.address}:${t.number}`,
      );
      evidence[id] = {
        status: "indexed",
        checkedAt,
        ...(chainRead
          ? {
              contractURIRead: {
                status: chainRead.status,
                value: chainRead.value,
                blockNumber: chainAudit.blockNumber,
                source: chainAudit.endpoint,
              },
            }
          : {}),
        metadataURI: t.metadataURI,
        metadataURL: gateway(t.metadataURI),
        mediaURI,
        mediaURL,
        imageURI: t.image?.cid || r.image?.cid,
        imageURL: gateway(t.image?.cid || r.image?.cid),
        indexedSource:
          "Supercollector public release page and release-search index",
        indexedSourceURL: r.source,
        sourceType: "official-public-index",
        verification:
          "Public platform mapping; contract URI read and playback checks tracked separately",
      };
    }
  return {
    recoveredAt: checkedAt,
    source: SUPER_SOURCE,
    scope:
      "Public release-search snapshot reconciled against artist directory; not a complete historical onchain census",
    records,
    evidence,
    unresolved,
  };
}
