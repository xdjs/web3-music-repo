import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import {
  PrivyProvider,
  usePrivy,
  useLogin,
  useLinkAccount,
  useWallets,
  useConnectWallet,
} from "@privy-io/react-auth";
import { AccountProfile } from "./account-profile.jsx";
import { createPlaylistSync } from "./playlist-sync.mjs";
import {
  accountRequest,
  loginErrorMessage,
  linkedWallets,
} from "./account-client.mjs";
function Account({ syncEnabled }) {
  const { ready, authenticated, user, logout, getAccessToken } = usePrivy();
  const [account, setAccount] = useState(null),
    [error, setError] = useState(""),
    [syncStatus, setSyncStatus] = useState({
      state: "guest",
      message: "Saved on this device. Sign in to sync playlists.",
    }),
    [retry, setRetry] = useState(0),
    [needsMusicNerdAccount, setNeedsMusicNerdAccount] = useState(false);
  const walletAddresses = linkedWallets(user?.linkedAccounts || [])
    .filter(
      (wallet) =>
        (wallet.chainType || "ethereum") === "ethereum" &&
        /^0x[0-9a-f]{40}$/i.test(wallet.address),
    )
    .map((wallet) => wallet.address.toLowerCase());
  const walletSignature = walletAddresses.join(",");
  useEffect(() => {
    const publish = () =>
      document.dispatchEvent(
        new CustomEvent("mn:account-wallets", {
          detail: {
            ready,
            authenticated,
            accountId: authenticated ? user?.id || null : null,
            addresses: authenticated
              ? walletSignature.split(",").filter(Boolean)
              : [],
          },
        }),
      );
    publish();
    document.addEventListener("mn:request-account-wallets", publish);
    return () =>
      document.removeEventListener("mn:request-account-wallets", publish);
  }, [ready, authenticated, user?.id, walletSignature]);
  const identity = useRef(user?.id);
  identity.current = authenticated ? user?.id : null;
  const { login: openLogin } = useLogin({
    onComplete: () => setError(""),
    onError: (e) => setError(loginErrorMessage(e)),
  });
  const login = () => {
    setError("");
    location.hash = "me";
    openLogin();
  };
  const [profileTarget, setProfileTarget] = useState(null);
  useEffect(() => {
    const attach = () => {
      const target = document.getElementById("profile-account");
      if (target && !target.querySelector(".profile-account-card"))
        target.replaceChildren();
      setProfileTarget(target);
    };
    attach();
    document.addEventListener("mn:route", attach);
    return () => document.removeEventListener("mn:route", attach);
  }, []);
  const [walletStatus, setWalletStatus] = useState("");
  const { wallets } = useWallets();
  const { linkWallet } = useLinkAccount({
    onSuccess: () =>
      setWalletStatus("Wallet added to your Music Nerd account."),
    onError: () =>
      setWalletStatus(
        "Wallet wasn’t linked. If it belongs to another account, sign in to that account first. You can also retry.",
      ),
  });
  const { connectWallet } = useConnectWallet({
    onSuccess: () =>
      setWalletStatus(
        "Wallet connected in this browser. Only wallets linked to your Music Nerd account appear above.",
      ),
    onError: () =>
      setWalletStatus("Connection wasn’t completed. You can retry."),
  });
  const request = (path, options = {}) => {
    const expectedIdentity = identity.current;
    return accountRequest(path, options, async () => {
      if (!expectedIdentity || identity.current !== expectedIdentity)
        throw Error("Your account changed. Please retry.");
      const token = await getAccessToken();
      if (identity.current !== expectedIdentity)
        throw Error("Your account changed. Please retry.");
      return token;
    });
  };
  const syncRef = useRef(null);
  const requestRef = useRef(request);
  requestRef.current = request;
  useEffect(() => {
    const publishLibrary = (detail) =>
      document.dispatchEvent(
        new CustomEvent("mn:playlist-library", { detail }),
      );
    let currentLibrary = { accountId: null, key: "mn-archive-playlists-v1" };
    let currentStatus;
    let sync;
    try {
      sync = createPlaylistSync({
        storage: localStorage,
        request: (...args) => requestRef.current(...args),
        isOnline: () => navigator.onLine !== false,
        isVisible: () => document.visibilityState !== "hidden",
        onLibrary: (detail) => {
          currentLibrary = detail;
          publishLibrary(detail);
        },
        onStatus: (detail) => {
          currentStatus = detail;
          setSyncStatus(detail);
          document.dispatchEvent(
            new CustomEvent("mn:playlist-sync-status", { detail }),
          );
        },
      });
    } catch {
      setSyncStatus({
        state: "retry",
        message:
          "Browser storage is unavailable. Playlist sync could not start.",
      });
      return;
    }
    syncRef.current = sync;
    const changed = (event) => sync.changed(event.detail?.key);
    const refresh = () => sync.refresh();
    const storageChanged = (event) => {
      if (event.key === currentLibrary.key) {
        publishLibrary(currentLibrary);
        sync.changed(event.key);
      }
    };
    const publish = () => {
      publishLibrary(currentLibrary);
      if (currentStatus)
        document.dispatchEvent(
          new CustomEvent("mn:playlist-sync-status", { detail: currentStatus }),
        );
    };
    document.addEventListener("mn:playlists-changed", changed);
    document.addEventListener("mn:request-playlist-sync", publish);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", storageChanged);
    sync.setAccount(ready && authenticated ? user?.id : null, { syncEnabled });
    return () => {
      sync.dispose();
      syncRef.current = null;
      document.removeEventListener("mn:playlists-changed", changed);
      document.removeEventListener("mn:request-playlist-sync", publish);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", storageChanged);
    };
  }, [ready, authenticated, user?.id, syncEnabled]);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setAccount(null);
    setError("");
    setWalletStatus("");
    setNeedsMusicNerdAccount(false);
    if (ready && authenticated) {
      request("/api/account", { signal: controller.signal })
        .then((value) => {
          if (!cancelled) setAccount(value);
        })
        .catch((error) => {
          if (!cancelled) {
            setError(error.message);
            setNeedsMusicNerdAccount(error.needsMusicNerdAccount === true);
          }
        });
    }
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ready, authenticated, user?.id, retry]);
  return (
    <div className="account-control">
      {authenticated ? (
        <a className="outline-button" href="#me">
          My profile
        </a>
      ) : (
        <button className="outline-button" disabled={!ready} onClick={login}>
          Sign in
        </button>
      )}
      {profileTarget &&
        createPortal(
          <AccountProfile
            ready={ready}
            authenticated={authenticated}
            name={account?.name}
            linkedAccounts={user?.linkedAccounts || []}
            wallets={wallets}
            onLogin={login}
            onLink={() => {
              setWalletStatus("");
              linkWallet();
            }}
            onConnect={() => connectWallet()}
            onLogout={() => {
              identity.current = null;
              document.dispatchEvent(
                new CustomEvent("mn:account-wallets", {
                  detail: {
                    ready: true,
                    authenticated: false,
                    accountId: null,
                    addresses: [],
                  },
                }),
              );
              setAccount(null);
              syncRef.current?.setAccount(null);
              logout();
            }}
            onRetry={() => setRetry((value) => value + 1)}
            needsMusicNerdAccount={needsMusicNerdAccount}
            showRetry={authenticated && !account && !!error}
            syncStatus={syncStatus}
            onSyncRetry={() => syncRef.current?.retry()}
            status={
              error ||
              (authenticated && !account
                ? "Verifying your Music Nerd account…"
                : "")
            }
            walletStatus={walletStatus}
          />,
          profileTarget,
        )}
    </div>
  );
}
function accountUnavailable(message) {
  document.getElementById("account-root").innerHTML =
    '<a class="outline-button" href="#me">My profile</a>';
  const show = () => {
    const target = document.getElementById("profile-account");
    if (target) {
      const p = document.createElement("p");
      p.className = "notice";
      p.textContent = message;
      target.replaceChildren(p);
    }
  };
  show();
  document.addEventListener("mn:route", show);
}
function ConfiguredAccount({ config }) {
  const currentTheme = () =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const [theme, setTheme] = useState(currentTheme);
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(currentTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);
  return (
    <PrivyProvider
      appId={config.appId}
      clientId={config.clientId || undefined}
      config={{
        appearance: {
          theme,
          accentColor: "#E91E8C",
          logo: "/musicnerd-lenses.png",
        },
        loginMethods: ["email", "wallet"],
        embeddedWallets: { ethereum: { createOnLogin: "off" } },
      }}
    >
      <Account
        syncEnabled={
          config.playlistStorage === "private-blob" ||
          config.playlistStorage === "archive-server"
        }
      />
    </PrivyProvider>
  );
}
fetch("/api/auth/config", { signal: AbortSignal.timeout(15000) })
  .then((r) => {
    if (!r.ok) throw Error("Config unavailable");
    return r.json();
  })
  .then((c) => {
    if (!c.enabled)
      return accountUnavailable(
        "Sign-in is not configured on this copy. You can still browse public wallets and keep playlists in this browser.",
      );
    createRoot(document.getElementById("account-root")).render(
      <ConfiguredAccount config={c} />,
    );
  })
  .catch(() =>
    accountUnavailable(
      "Account connection is unavailable. Reload to retry; your browser playlists remain available.",
    ),
  );
