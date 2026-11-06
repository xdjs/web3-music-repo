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
import { accountRequest, loginErrorMessage } from "./account-client.mjs";
function Account() {
  const { ready, authenticated, user, logout, getAccessToken } = usePrivy();
  const [account, setAccount] = useState(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(null),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0),
    [needsMusicNerdAccount, setNeedsMusicNerdAccount] = useState(false);
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
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setAccount(null);
    setRevision(null);
    setError("");
    setWalletStatus("");
    setNeedsMusicNerdAccount(false);
    setBusy(false);
    if (ready && authenticated) {
      (async () => {
        try {
          const a = await request("/api/account", {
            signal: controller.signal,
          });
          const library = await request("/api/account/playlists", {
            signal: controller.signal,
          });
          if (!cancelled) {
            setAccount(a);
            setRevision(library.revision);
          }
        } catch (e) {
          if (!cancelled) {
            setError(e.message);
            setNeedsMusicNerdAccount(e.needsMusicNerdAccount === true);
          }
        }
      })();
    }
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ready, authenticated, user?.id, retry]);
  async function save() {
    const startedFor = identity.current;
    if (!startedFor || !account || revision === null) return;
    setBusy(true);
    setError("");
    try {
      const playlists = JSON.parse(
        localStorage.getItem("mn-archive-playlists-v1") || "[]",
      );
      const d = await request("/api/account/playlists", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision, playlists }),
      });
      if (identity.current !== startedFor) return;
      setRevision(d.revision);
      setError("Playlists saved to your Music Nerd account.");
    } catch (e) {
      if (identity.current === startedFor) setError(e.message);
    } finally {
      if (identity.current === startedFor) setBusy(false);
    }
  }
  async function load() {
    const startedFor = identity.current;
    if (!startedFor || !account) return;
    if (
      !confirm(
        "Replace this browser’s playlists with your saved account library? Export your local playlists first if you want to keep both.",
      )
    )
      return;
    setBusy(true);
    try {
      const d = await request("/api/account/playlists");
      if (identity.current !== startedFor) return;
      localStorage.setItem(
        "mn-archive-playlists-v1",
        JSON.stringify(d.playlists),
      );
      location.hash = "me?tab=playlists";
      location.reload();
    } catch (e) {
      if (identity.current === startedFor) {
        setError(e.message);
        setBusy(false);
      }
    }
  }
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
              setAccount(null);
              setRevision(null);
              logout();
            }}
            onRetry={() => setRetry((value) => value + 1)}
            needsMusicNerdAccount={needsMusicNerdAccount}
            showRetry={authenticated && !account && !!error}
            onSave={save}
            onLoad={load}
            canSync={!!account && revision !== null}
            busy={busy}
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
      <Account />
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
