#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const AUTH_URL = "https://accounts.secure.freee.co.jp/public_api/authorize";
const TOKEN_URL = "https://accounts.secure.freee.co.jp/public_api/token";

function argValue(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

function replaceEnvValue(filePath, key, value) {
  if (!value) return false;
  const lineValue = `${key}=${value}`;
  if (!fs.existsSync(filePath)) return false;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  let replaced = false;
  const next = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      replaced = true;
      return lineValue;
    }
    return line;
  });
  if (!replaced) next.push(lineValue);
  fs.writeFileSync(filePath, next.join("\n").replace(/\n*$/, "\n"));
  return true;
}

function writeEnv(tokens) {
  const files = [".env.local", ".env.production.local"].map((name) => path.join(process.cwd(), name));
  const written = [];
  for (const filePath of files) {
    let changed = false;
    changed = replaceEnvValue(filePath, "FREEE_REFRESH_TOKEN", tokens.refresh_token) || changed;
    changed = replaceEnvValue(filePath, "FREEE_COMPANY_ID", tokens.company_id) || changed;
    if (changed) written.push(filePath);
  }
  return written;
}

function sha8(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 8);
}

async function writeSupabase(tokens) {
  if (!tokens.refresh_token) return { skipped: "no refresh_token" };
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return { skipped: "Supabase env missing" };

  const { createClient } = require("@supabase/supabase-js");
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await supabase
    .from("freee_oauth_tokens")
    .upsert({
      token_key: "default",
      refresh_token: tokens.refresh_token,
      company_id: tokens.company_id ? String(tokens.company_id) : process.env.FREEE_COMPANY_ID ?? null,
      scope: tokens.scope ?? null,
      external_cid: tokens.external_cid ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "token_key" });
  if (error) throw error;
  return { ok: true };
}

function buildAuthorizeUrl({ clientId, redirectUri, state }) {
  const url = new URL(AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_company");
  return url.toString();
}

function waitForCode({ port, state }) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url || "/", `http://localhost:${port}`);
        if (url.pathname !== "/callback") {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("not found");
          return;
        }
        const error = url.searchParams.get("error");
        if (error) throw new Error(`${error}: ${url.searchParams.get("error_description") || ""}`);
        const returnedState = url.searchParams.get("state");
        if (returnedState !== state) throw new Error("state mismatch");
        const code = url.searchParams.get("code");
        if (!code) throw new Error("code missing");
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<html><body><h1>freee authorization received</h1><p>このタブは閉じてOK。</p></body></html>");
        server.close();
        resolve(code);
      } catch (error) {
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(error instanceof Error ? error.message : String(error));
        server.close();
        reject(error);
      }
    });
    server.listen(port, "127.0.0.1", () => {
      console.log(`listening: http://127.0.0.1:${port}/callback`);
    });
  });
}

async function exchangeCode({ clientId, clientSecret, code, redirectUri }) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`freee token exchange failed: ${res.status} ${text}`);
  }
  return data;
}

async function main() {
  const clientId = process.env.FREEE_CLIENT_ID;
  const clientSecret = process.env.FREEE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("FREEE_CLIENT_ID / FREEE_CLIENT_SECRET not set");

  const port = Number(argValue("port") || process.env.FREEE_OAUTH_PORT || 33333);
  const useLocalCallback = process.argv.includes("--local-callback");
  const redirectUri = argValue("redirect-uri") ||
    process.env.FREEE_REDIRECT_URI ||
    (useLocalCallback ? `http://127.0.0.1:${port}/callback` : "urn:ietf:wg:oauth:2.0:oob");
  const state = crypto.randomBytes(24).toString("hex");
  const authUrl = buildAuthorizeUrl({ clientId, redirectUri, state });
  const providedCode = argValue("code");

  let code = providedCode;
  if (!code) {
    console.log("Open this URL and authorize freee:");
    console.log(authUrl);
    console.log("");
    console.log(`redirect_uri=${redirectUri}`);
  }

  if (!code && redirectUri.startsWith("urn:")) {
    console.log("");
    console.log("OOB redirect URI mode: after authorization, rerun with --code=AUTHORIZATION_CODE");
    return;
  }

  if (!code) code = await waitForCode({ port, state });
  const token = await exchangeCode({ clientId, clientSecret, code, redirectUri });

  console.log("");
  console.log("freee token response:");
  console.log(JSON.stringify({
    token_type: token.token_type,
    expires_in: token.expires_in,
    scope: token.scope,
    company_id: token.company_id,
    external_cid: token.external_cid,
    access_token_present: Boolean(token.access_token),
    refresh_token_present: Boolean(token.refresh_token),
    refresh_token_sha8: token.refresh_token ? sha8(token.refresh_token) : null,
  }, null, 2));
  console.log("");
  if (process.argv.includes("--print-secrets")) {
    if (token.refresh_token) console.log(`FREEE_REFRESH_TOKEN=${token.refresh_token}`);
    if (token.company_id) console.log(`FREEE_COMPANY_ID=${token.company_id}`);
  }

  if (process.argv.includes("--write-env")) {
    const written = writeEnv(token);
    console.log("");
    console.log(`updated env files: ${written.length ? written.join(", ") : "(none)"}`);
  }
  if (process.argv.includes("--write-supabase") || process.argv.includes("--write-env")) {
    const result = await writeSupabase(token);
    console.log(`updated supabase: ${JSON.stringify(result)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
