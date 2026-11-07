// Both public archive addresses remain supported so device-only playlists on
// the original origin can sync before their owner moves to the renamed site.
const archiveOrigins = [
  "https://web3-music-archive.vercel.app",
  "https://web3-music-repo.vercel.app",
  "http://127.0.0.1:4190",
  "http://localhost:4190",
];

export function isAccountWriteOriginAllowed(
  origin,
  { archiveOrigin, deploymentHostname } = {},
) {
  // Non-browser clients still require a verified bearer token and account.
  if (origin === undefined) return true;
  return (
    typeof origin === "string" &&
    [
      ...archiveOrigins,
      archiveOrigin,
      deploymentHostname ? `https://${deploymentHostname}` : null,
    ]
      .filter(Boolean)
      .includes(origin)
  );
}
