"""
GOOGLE_OAUTH_REFRESH_TOKEN を発行するワンショットスクリプト。
標準 lib のみで動く (pip install 不要)。

使い方:
  1. .env.local に以下を追加 (まだなら):
       GOOGLE_OAUTH_CLIENT_ID=xxx.apps.googleusercontent.com
       GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-...
  2. Google Cloud Console で OAuth Client の Authorized redirect URIs に
     "http://localhost:9001/" (末尾スラッシュ込み) を追加
     (Desktop application タイプならこの設定不要、自動で localhost 許可)
  3. このスクリプトを実行:
       cd /Users/masa/projects/AMD/amd-os/pwa
       python3 -X utf8 scripts/get_google_refresh_token.py
  4. ブラウザが立ち上がるので Google アカウント (masa@team-armada.jp) でログイン
  5. 端末に Refresh token が出力される → コピー
  6. Vercel env (production) に GOOGLE_OAUTH_REFRESH_TOKEN として登録

scope: Drive readonly + Gmail readonly + Calendar readonly
"""

from __future__ import annotations

import http.server
import json
import os
import secrets
import socketserver
import sys
import threading
import urllib.parse
import urllib.request
import webbrowser

REDIRECT_URI = "http://localhost:9001/"
SCOPES = [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/userinfo.email",   # 確認用
]


def load_env(path: str = ".env.local") -> dict[str, str]:
    env: dict[str, str] = {}
    if not os.path.exists(path):
        return env
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            v = v.strip().strip('"').strip("'").replace("\\r", "").replace("\\n", "").strip()
            env[k.strip()] = v
    return env


# 受け取った authorization code を共有するためのコンテナ
result_container: dict[str, str | None] = {"code": None, "error": None, "state": None}


class CallbackHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802 (Python http server convention)
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        if "code" in params:
            result_container["code"] = params["code"][0]
        if "error" in params:
            result_container["error"] = params["error"][0]
        if "state" in params:
            result_container["state"] = params["state"][0]
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        body = """<!doctype html><meta charset="utf-8">
<title>OAuth complete</title>
<body style="font-family:sans-serif;padding:2em;text-align:center;">
<h1 style="color:#16a34a">認証完了 ✓</h1>
<p>このタブは閉じて、ターミナルに戻ってください。</p>
</body>"""
        self.wfile.write(body.encode("utf-8"))

    def log_message(self, format, *args):  # 黙らせる
        pass


def main() -> None:
    env = load_env()
    client_id = env.get("GOOGLE_OAUTH_CLIENT_ID") or os.environ.get("GOOGLE_OAUTH_CLIENT_ID")
    client_secret = env.get("GOOGLE_OAUTH_CLIENT_SECRET") or os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET")
    if not client_id or not client_secret:
        print("❌ GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET が .env.local に無い")
        print("   .env.local に以下 2 行を追加してから再実行:")
        print('     GOOGLE_OAUTH_CLIENT_ID="xxx.apps.googleusercontent.com"')
        print('     GOOGLE_OAUTH_CLIENT_SECRET="GOCSPX-..."')
        sys.exit(1)

    state = secrets.token_urlsafe(16)
    auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode({
        "client_id": client_id,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",      # refresh token を返してもらう必須
        "prompt": "consent",            # 過去同意済でも refresh token を再発行
        "state": state,
    })

    # ローカル callback server を立てる
    httpd = socketserver.TCPServer(("localhost", 9001), CallbackHandler)
    httpd_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    httpd_thread.start()

    print("🌐 ブラウザを開いて Google アカウントでログインしてください...")
    print(f"   (もし開かなければ手動で: {auth_url})")
    webbrowser.open(auth_url)

    # 認証完了まで待つ (最大 5 分)
    waited = 0
    while result_container["code"] is None and result_container["error"] is None and waited < 300:
        threading.Event().wait(1)
        waited += 1

    httpd.shutdown()
    httpd.server_close()

    if result_container["error"]:
        print(f"❌ 認証失敗: {result_container['error']}")
        sys.exit(1)
    if not result_container["code"]:
        print("❌ タイムアウト (5 分以内に認証完了しなかった)")
        sys.exit(1)
    if result_container["state"] != state:
        print("❌ state 不一致 (CSRF の可能性)")
        sys.exit(1)

    code = result_container["code"]
    print("🔑 authorization code 取得 → token endpoint と交換中...")

    # POST https://oauth2.googleapis.com/token
    token_body = urllib.parse.urlencode({
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": REDIRECT_URI,
        "grant_type": "authorization_code",
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=token_body,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            tokens = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:  # noqa: BLE001 (intentional)
        print(f"❌ token exchange 失敗 ({e.code})")
        print(e.read().decode("utf-8"))
        sys.exit(1)

    refresh_token = tokens.get("refresh_token")
    access_token = tokens.get("access_token")
    if not refresh_token:
        print("❌ refresh_token が返ってこない")
        print("   原因候補:")
        print("   1. 過去同じ scope で同意済 → 再度同意画面が出ない")
        print("      → Google Account の Security → Third-party access で対象 app の権限を取り消してから再実行")
        print("   2. OAuth Client の設定で 'External' か 'Internal' を Internal にしてる場合、テストユーザー追加が必要")
        print(f"   返ってきた tokens: {tokens}")
        sys.exit(1)

    print("\n=========================================")
    print("✅ Refresh token 発行成功")
    print("=========================================")
    print(f"GOOGLE_OAUTH_REFRESH_TOKEN={refresh_token}")
    print("=========================================")
    print("\n次のステップ:")
    print("  1. 上の値を Vercel production env に登録 (もしくは Claude Code に貼って登録依頼)")
    print("  2. 念のため access_token も検証 (Drive で 1 ファイル list)")

    # access token で動作確認 (Drive ファイル 1 件 list)
    if access_token:
        try:
            verify_req = urllib.request.Request(
                "https://www.googleapis.com/drive/v3/files?pageSize=1&fields=files(id,name)",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            with urllib.request.urlopen(verify_req, timeout=10) as r:
                drive_data = json.loads(r.read().decode("utf-8"))
            files = drive_data.get("files", [])
            print(f"\n[検証] Drive API: ファイル取得成功 ({len(files)} 件取れた)")
        except Exception as e:  # noqa: BLE001
            print(f"\n[検証] Drive API 失敗: {e}")


if __name__ == "__main__":
    main()
