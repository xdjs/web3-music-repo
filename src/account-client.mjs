export function loginErrorMessage(error) {
  const code =
    typeof error === "string" ? error : error?.code || error?.message || "";
  if (/invalid.origin|origin.*not.*allow/i.test(code))
    return "Sign-in is not enabled for this address yet. Your browser playlists are still available.";
  if (/cancel|closed/i.test(code))
    return "Sign-in was cancelled. You can try again.";
  return "Sign-in could not be completed. Please try again.";
}

export async function accountRequest(
  path,
  options,
  getAccessToken,
  fetcher = fetch,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
) {
  let token;
  for (let attempt = 0; attempt < 3; attempt++) {
    options?.signal?.throwIfAborted();
    token = await getAccessToken();
    if (token) break;
    if (attempt < 2) await wait(300 * (attempt + 1));
  }
  options?.signal?.throwIfAborted();
  if (!token)
    throw Error(
      "Your session is still loading. Retry your account connection.",
    );
  const response = await fetcher(path, {
    ...options,
    signal: options?.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(20000)])
      : AbortSignal.timeout(20000),
    headers: { ...options?.headers, Authorization: "Bearer " + token },
  });
  const body = await response.json();
  if (!response.ok) {
    const error = Error(
      body.error ||
        (response.status === 409
          ? "Saved playlists changed. Load the latest library before saving."
          : "Account request failed. Please retry."),
    );
    error.needsMusicNerdAccount = body.needsMusicNerdAccount === true;
    error.status = response.status;
    throw error;
  }
  return body;
}

export function linkedWallets(accounts = []) {
  const seen = new Set();
  return accounts.filter((account) => {
    if (account.type !== "wallet" || typeof account.address !== "string")
      return false;
    const chain = account.chainType || "ethereum";
    const address =
      chain === "ethereum" ? account.address.toLowerCase() : account.address;
    const key = `${chain}:${address}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
