export function isEmbeddedAccountContext(view = globalThis.window) {
  if (!view) return false;
  try {
    return view.self !== view.top;
  } catch {
    return true;
  }
}

export function standaloneAccountURL(href) {
  try {
    const url = new URL(href);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw Error("Unsupported account origin");
    return new URL("/#me", url.origin).href;
  } catch {
    return "https://web3-music-archive.vercel.app/#me";
  }
}

// Do not initialize wallet providers or nested auth frames inside another app.
// Native links retain the user's explicit gesture and cannot be popup-blocked
// like an asynchronous window.open after an SDK request.
export function installEmbeddedAccount(document, href) {
  const url = standaloneAccountURL(href);
  function link(className, text) {
    const a = document.createElement("a");
    a.className = className;
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = text;
    a.setAttribute("aria-label", "Sign in to Music Nerd in a new tab");
    return a;
  }
  const control = document.createElement("div");
  control.className = "account-control";
  control.append(link("outline-button", "Sign in ↗"));
  document.getElementById("account-root")?.replaceChildren(control);
  function show() {
    const target = document.getElementById("profile-account");
    if (!target) return;
    const card = document.createElement("section");
    card.className = "profile-account-card";
    card.setAttribute("aria-label", "Music Nerd account");
    const head = document.createElement("div");
    head.className = "section-head";
    const copy = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = "Your Music Nerd account";
    const description = document.createElement("p");
    description.textContent =
      "Open the full app to sign in, connect wallets and access your saved library. You can keep listening here.";
    copy.append(title, description);
    head.append(copy, link("primary", "Open sign-in ↗"));
    card.append(head);
    target.replaceChildren(card);
  }
  show();
  const publish = () =>
    document.dispatchEvent(
      new document.defaultView.CustomEvent("mn:account-wallets", {
        detail: {
          ready: true,
          authenticated: false,
          accountId: null,
          addresses: [],
        },
      }),
    );
  publish();
  document.addEventListener("mn:route", show);
  document.addEventListener("mn:request-account-wallets", publish);
  return () => {
    document.removeEventListener("mn:route", show);
    document.removeEventListener("mn:request-account-wallets", publish);
  };
}
