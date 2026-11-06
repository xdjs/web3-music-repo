import { mintSongsIPFS, mintSongsTokenURI } from "./mint-songs.mjs";
import { extractMusicMetadata } from "./extract-music-metadata.mjs";
export const MINT_SONGS_POLYGON = "0xc29cbe04ae322469dc077741afa2fbccda748ae4";
const gateway = (uri) =>
  uri ? `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}` : null;

export function decodeMintSongsPolygon(raw) {
  const uri = mintSongsTokenURI(raw);
  if (!uri.startsWith("data:application/json;base64,"))
    throw Error("Expected onchain base64 JSON");
  if (uri.length > 1400000) throw Error("Metadata exceeds limit");
  // Preserve malformed JSON as unresolved; never guess escaping in artist prose.
  const metadata = JSON.parse(
    Buffer.from(uri.slice(29), "base64").toString("utf8"),
  );
  const traits = Object.fromEntries(
    (metadata.attributes || []).map((a) => [a.trait_type, a.value]),
  );
  if (!String(traits.Song || "").trim() || !String(traits.Artist || "").trim())
    throw Error("Missing original song/artist attributes");
  for (const key of ["Song Number", "Edition Number", "Edition Count"]) {
    if (!Number.isSafeInteger(traits[key]) || traits[key] < 1)
      throw Error(`Invalid ${key}`);
  }
  if (traits["Edition Number"] > traits["Edition Count"])
    throw Error("Edition number exceeds count");
  const mediaURI = mintSongsIPFS(metadata.animation_url);
  if (!mediaURI) throw Error("Missing IPFS media reference");
  return {
    uri,
    metadata,
    traits,
    mediaURI,
    isTest: /^test(?:\b|$)/i.test(traits.Song.trim()),
  };
}

export function mintSongsPolygonBundle(discovery) {
  if (
    discovery.chainId !== 137 ||
    discovery.contract?.toLowerCase() !== MINT_SONGS_POLYGON
  )
    throw Error("Wrong Polygon contract");
  const records = [],
    evidence = {},
    originals = {},
    groups = new Map();
  const report = {
    checkedTokens: 0,
    importedSongs: 0,
    testTokens: [],
    unresolved: [],
    mediaUnverified: [],
    duplicateEditions: 0,
    complete: false,
  };
  for (const sample of discovery.samples || []) {
    report.checkedTokens++;
    try {
      if (!/^\d+$/.test(String(sample.tokenId)))
        throw Error("Invalid token ID");
      if (sample.rpcResponse?.error)
        throw Error(sample.rpcResponse.error.message);
      const decoded = decodeMintSongsPolygon(sample.rpcResponse?.result);
      if (decoded.isTest) {
        report.testTokens.push(sample.tokenId);
        continue;
      }
      const media = sample.mediaCheck;
      if (
        media?.status !== 200 ||
        !/^audio\//.test(media.contentType || "") ||
        media.uri !== decoded.mediaURI
      ) {
        report.mediaUnverified.push(sample.tokenId);
        continue;
      }
      const { traits, metadata, mediaURI, uri } = decoded;
      const group = `${traits["Song Number"]}:${mediaURI}`;
      if (groups.has(group)) {
        const existing = groups.get(group);
        if (
          existing.title !== traits.Song ||
          existing.artist !== traits.Artist ||
          existing.editionSupply !== traits["Edition Count"]
        )
          throw Error("Conflicting song attributes across editions");
        existing.observedTokenIds.push(String(sample.tokenId));
        report.duplicateEditions++;
        continue;
      }
      const id = `mint-songs-137-${MINT_SONGS_POLYGON.slice(2)}-${sample.tokenId}`;
      const sourceURL = `https://polygonscan.com/token/${MINT_SONGS_POLYGON}?a=${sample.tokenId}`;
      const record = {
        id,
        chainId: 137,
        standard: "ERC721",
        contract: MINT_SONGS_POLYGON,
        tokenId: String(sample.tokenId),
        platform: "Mint Songs",
        kind: "audio",
        title: traits.Song,
        artist: traits.Artist,
        note: metadata.description || "",
        imageURI: mintSongsIPFS(metadata.image),
        mintSongsSongId: String(traits["Song Number"]),
        editionSupply: traits["Edition Count"],
        editionNumber: traits["Edition Number"],
        observedTokenIds: [String(sample.tokenId)],
        originalRelease: `https://factory.mintsongs.com/songs/${traits["Song Number"]}`,
        musicMetadata: {
          status: "read",
          schemaVersion: 3,
          source: uri,
          sourceType: "onchain-json",
          metadataURL: sourceURL,
          recoveredAt: sample.checkedAt || discovery.checkedAt,
          ...extractMusicMetadata(metadata),
        },
      };
      records.push(record);
      groups.set(group, record);
      evidence[id] = {
        status: "indexed",
        checkedAt: sample.checkedAt || discovery.checkedAt,
        referenceBlock: sample.referenceBlock || discovery.referenceBlock,
        metadataURI: uri,
        metadataURL: sourceURL,
        mediaURI,
        mediaURL: gateway(mediaURI),
        imageURI: record.imageURI,
        imageURL: gateway(record.imageURI),
        contentType: media.contentType,
        sourceName: "Mint Songs Polygon onchain metadata",
        sourceURL,
        note: "Original base64 JSON read directly from tokenURI at the recorded Polygon block. Audio HTTP headers verified; playback and current holders are separate checks.",
      };
      originals[id] = {
        chainId: 137,
        metadata: {
          contract: { address: MINT_SONGS_POLYGON },
          tokenId: String(sample.tokenId),
          block: { number: evidence[id].referenceBlock },
          tokenURI: uri,
        },
        results: metadata,
        tokenURICall: sample.rpcResponse.result,
      };
    } catch (error) {
      report.unresolved.push({
        tokenId: sample.tokenId,
        reason: error.message,
      });
    }
  }
  report.importedSongs = records.length;
  return { bundle: { records, evidence }, originals, report };
}
