export const walletChains = {
  1: "Ethereum",
  10: "Optimism",
  8453: "Base",
  137: "Polygon",
  7777777: "Zora",
};
export const normalizeWallet = (value) =>
  /^0x[0-9a-f]{40}$/i.test(String(value || "")) ? value.toLowerCase() : "";

// Public holdings only; identity changes invalidate even pending public lookups so
// results selected for a previous signed-in account cannot reappear in its place.
export function createWalletLibraryState({
  fetchPage,
  onChange = () => {},
  concurrency = 2,
}) {
  let accountId = null,
    linked = [],
    address = "",
    automatic = false,
    epoch = 0,
    running = 0;
  const states = new Map(),
    pending = [];
  const controllers = new Set();
  const key = (chain, wallet = address) => wallet + ":" + chain;
  function cancel() {
    epoch++;
    pending.length = 0;
    for (const controller of controllers) controller.abort();
    for (const [k, s] of states)
      if (["queued", "loading"].includes(s.status)) states.delete(k);
  }
  function setAccount(value) {
    if (!value?.ready) return;
    const nextId =
      value.authenticated && value.accountId ? value.accountId : null;
    if (nextId !== accountId) {
      cancel();
      states.clear();
      if (automatic) {
        address = "";
        automatic = false;
      }
      accountId = nextId;
    }
    linked = nextId
      ? [
          ...new Set(
            (Array.isArray(value.addresses) ? value.addresses : [])
              .map(normalizeWallet)
              .filter(Boolean),
          ),
        ]
      : [];
  }
  function select(requested = "", embedded = false) {
    const explicit = normalizeWallet(requested);
    // An explicitly supplied invalid address must not silently become a linked wallet.
    const next =
      explicit || (!requested && embedded && accountId ? linked[0] || "" : "");
    const nextAutomatic = !!next && !requested && embedded;
    if (next !== address) {
      cancel();
      address = next;
    }
    automatic = nextAutomatic;
    return address;
  }
  function snapshot() {
    return {
      accountId,
      address,
      automatic,
      linked: [...linked],
      states: new Map(
        [...Object.keys(walletChains)].map((chain) => [
          chain,
          states.get(key(chain)),
        ]),
      ),
    };
  }
  function emit() {
    onChange(snapshot());
  }
  function enqueue(chain, manual = false, wallet = address) {
    if (!wallet || !Object.hasOwn(walletChains, chain)) return;
    const k = key(chain, wallet),
      prior = states.get(k);
    if (prior && (!manual || ["queued", "loading"].includes(prior.status)))
      return;
    const cursor = prior?.nextCursor || null;
    const s = {
      items: cursor || prior?.error ? [...(prior?.items || [])] : [],
      nextCursor: cursor,
      status: "queued",
      error: null,
      checkedAt: prior?.checkedAt || null,
    };
    states.set(k, s);
    pending.push({ address: wallet, chain, k, s, cursor, epoch });
    emit();
    drain();
  }
  function drain() {
    while (running < concurrency && pending.length) {
      const job = pending.shift();
      if (job.epoch !== epoch) continue;
      running++;
      job.s.status = "loading";
      const controller = new AbortController();
      controllers.add(controller);
      emit();
      Promise.resolve()
        .then(() =>
          fetchPage(job.address, job.chain, job.cursor, controller.signal),
        )
        .then((data) => {
          if (job.epoch !== epoch) return;
          if (data?.status !== "indexed" || !Array.isArray(data.items))
            throw Error(
              data?.message ||
                "This network could not be checked. Retry to continue.",
            );
          if (data.nextCursor && data.nextCursor === job.cursor)
            throw Error("The index repeated a page. Retry later.");
          const tokenKey = (i) =>
            String(i.contract).toLowerCase() + ":" + i.tokenId;
          const seen = new Set(job.s.items.map(tokenKey));
          for (const item of data.items) {
            const k = tokenKey(item);
            if (!seen.has(k)) {
              seen.add(k);
              job.s.items.push(item);
            }
          }
          job.s.nextCursor = data.nextCursor || null;
          job.s.checkedAt = data.checkedAt;
          job.s.status = "ready";
        })
        .catch((error) => {
          if (job.epoch !== epoch) return;
          job.s.status = "error";
          job.s.error =
            error?.name === "TimeoutError"
              ? "This network took too long to respond. Retry to continue."
              : error?.message ||
                "This network could not be checked. Retry to continue.";
        })
        .finally(() => {
          controllers.delete(controller);
          running--;
          if (job.epoch === epoch) emit();
          drain();
        });
    }
  }
  function start() {
    for (const chain of Object.keys(walletChains)) enqueue(chain);
  }
  // Explore's owned filter never borrows an unrelated public-wallet lookup.
  // Reuse exact catalog matches from indexed holdings; do not infer creations.
  function ownedSnapshot() {
    const recordIds = new Set();
    let loading = 0,
      errors = 0,
      unchecked = 0,
      more = 0;
    for (const wallet of linked)
      for (const chain of Object.keys(walletChains)) {
        const s = states.get(key(chain, wallet));
        if (!s) unchecked++;
        else {
          if (["queued", "loading"].includes(s.status)) loading++;
          if (s.status === "error") errors++;
          if (s.nextCursor) more++;
          for (const item of s.items)
            if (item.recordId) recordIds.add(item.recordId);
        }
      }
    return {
      accountId,
      linked: [...linked],
      recordIds,
      loading,
      errors,
      unchecked,
      more,
      automaticWalletLimit: 5,
    };
  }
  function startLinked() {
    for (const wallet of linked.slice(0, 5))
      for (const chain of Object.keys(walletChains))
        enqueue(chain, false, wallet);
  }
  return {
    setAccount,
    select,
    start,
    scan: (chain) => enqueue(String(chain), true),
    snapshot,
    ownedSnapshot,
    startLinked,
    dispose: cancel,
  };
}
