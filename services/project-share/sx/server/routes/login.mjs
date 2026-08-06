import { LOGO_SYMBOL_DATA_URL, LOGO_TYPE_DATA_URL } from "../brand-data.mjs";
import { readFormCredentials } from "../lib/body.mjs";
import { passwordsMatch, buildSessionCookie, checkMembership } from "../lib/auth.mjs";
import { sendHtml, sendText } from "../lib/respond.mjs";
import { renderPortalHtml } from "./portal.mjs";

export function loginPageHtml(errored) {
  const errorBlock = errored
    ? '<p class="error" role="alert">メールアドレスまたはパスワードが違います。</p>'
    : "";
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SX PROJECT SHARE</title>
<style>
  :root {
    color-scheme: light;
    --amd-blue: #027FDC;
    --amd-navy: #18242E;
    --white: #FFFFFF;
    --text: #1F2933;
    --line: #D9E2EC;
    --pale-blue: #E8F3FC;
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body {
    font-family: "Yu Gothic", -apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif;
    background: var(--white);
    color: var(--text);
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 24px;
  }
  .panel {
    width: 100%;
    max-width: 400px;
    border-left: 3px solid var(--amd-blue);
    padding: 32px 30px;
  }
  .brand { display: flex; align-items: center; gap: 10px; margin: 0 0 26px; }
  .brand img:first-child { width: 26px; height: 26px; object-fit: contain; }
  .brand img:last-child { width: 128px; height: auto; object-fit: contain; }
  .panel h1 {
    font-size: 14px;
    letter-spacing: 0.02em;
    color: var(--amd-navy);
    margin: 0 0 6px;
    font-weight: 700;
  }
  .panel p.lead {
    font-size: 13px;
    color: var(--amd-navy);
    margin: 0 0 22px;
    line-height: 1.7;
  }
  label {
    display: block;
    font-size: 12.5px;
    font-weight: 700;
    color: var(--text);
    margin-bottom: 7px;
  }
  input + label { margin-top: 16px; }
  input[type="email"],
  input[type="password"] {
    width: 100%;
    padding: 11px 12px;
    border: 1px solid var(--line);
    border-radius: 4px;
    font-size: 16px;
    color: var(--text);
    background: var(--white);
  }
  input[type="email"]:focus,
  input[type="password"]:focus {
    outline: 2px solid var(--amd-blue);
    outline-offset: 1px;
  }
  button {
    width: 100%;
    margin-top: 18px;
    padding: 12px 14px;
    border: none;
    border-radius: 4px;
    background: var(--amd-blue);
    color: #fff;
    font-size: 14.5px;
    font-weight: 700;
    cursor: pointer;
  }
  button:hover { background: #0568b4; }
  .error {
    margin: 0 0 16px;
    padding: 9px 11px;
    background: var(--pale-blue);
    border: 1px solid var(--line);
    color: var(--text);
    border-radius: 4px;
    font-size: 12.5px;
  }
  @media (max-width: 480px) {
    body { padding: 16px; }
    .panel { padding: 24px 18px; border-left-width: 3px; }
  }
</style>
</head>
<body>
  <main class="panel">
    <div class="brand">
      <img src="${LOGO_SYMBOL_DATA_URL}" alt="Team ARMADA symbol" />
      <img src="${LOGO_TYPE_DATA_URL}" alt="team ARMADA" />
    </div>
    <h1>SX PROJECT SHARE</h1>
    <p class="lead">閲覧には登録済みのメールアドレスとパスワードが必要です。</p>
    ${errorBlock}
    <form method="post" action="/">
      <label for="email">メールアドレス</label>
      <input type="email" id="email" name="email" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="254" autofocus required />
      <label for="password">パスワード</label>
      <input type="password" id="password" name="password" autocomplete="current-password" required />
      <button type="submit">閲覧する</button>
    </form>
  </main>
</body>
</html>`;
}

export async function handleLoginRoute(req, res, { password, secret, initialEmails, hasMemberFn, isAuthed }) {
  if (req.method === "GET") {
    sendHtml(res, 200, isAuthed ? renderPortalHtml() : loginPageHtml(false));
    return;
  }

  if (req.method === "POST") {
    let email, submittedPassword;
    try {
      ({ email, password: submittedPassword } = await readFormCredentials(req));
    } catch {
      sendText(res, 400, "Bad Request");
      return;
    }
    const passwordOk = passwordsMatch(secret, submittedPassword, password);
    let emailOk = false;
    try {
      emailOk = await checkMembership(email, { initialEmails, hasMemberFn });
    } catch {
      // Membership backend failure: fail closed, same generic error as a
      // wrong email/password so this never becomes an existence oracle.
      emailOk = false;
    }
    if (!emailOk || !passwordOk) {
      sendHtml(res, 401, loginPageHtml(true));
      return;
    }
    res.setHeader("Set-Cookie", buildSessionCookie(secret, { email, password }));
    res.setHeader("Location", "/");
    res.status(303).send("");
    return;
  }

  res.setHeader("Allow", "GET, POST");
  sendText(res, 405, "Method Not Allowed");
}
