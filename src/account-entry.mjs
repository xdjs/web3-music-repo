import {
  isEmbeddedAccountContext,
  installEmbeddedAccount,
} from "./account-context.mjs";

if (isEmbeddedAccountContext()) {
  installEmbeddedAccount(document, location.href);
} else {
  import("./account-login.jsx");
}
