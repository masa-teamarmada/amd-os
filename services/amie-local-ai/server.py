"""Single-user, loopback-only research assistant. Python standard library only."""
from __future__ import annotations

import argparse
from contextlib import contextmanager, nullcontext
from datetime import datetime, timezone
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import secrets
import sqlite3
import subprocess
import sys
import threading
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

MODEL = "qwen3:4b-instruct"
OLLAMA_URL = "http://127.0.0.1:11439"
APP = Path(__file__).resolve().parent
MAX_TEXT = 500_000
MAX_BODY = 2_000_000
EXTENSIONS = {".txt", ".md", ".csv", ".tsv", ".json", ".jsonl"}


def tokens(text: str) -> list[str]:
    text = unicodedata.normalize("NFKC", text).lower()
    words = re.findall(r"[a-z0-9_]{2,}|[ぁ-んァ-ヶ一-龯々ー]+", text)
    result = []
    for word in words:
        if re.fullmatch(r"[a-z0-9_]+", word):
            result.append(word)
        elif len(word) > 1:
            result.extend(word[i:i + 2] for i in range(len(word) - 1))
    return list(dict.fromkeys(result))


class Store:
    def __init__(self, folder: Path):
        folder.mkdir(parents=True, exist_ok=True)
        self.path = folder / "knowledge.sqlite3"
        with self.db() as db:
            db.executescript("""
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY, name TEXT NOT NULL, body TEXT NOT NULL, created TEXT NOT NULL,
                    source_date TEXT NOT NULL DEFAULT '');
                CREATE TABLE IF NOT EXISTS chunks (
                    id INTEGER PRIMARY KEY, document_id TEXT NOT NULL, body TEXT NOT NULL,
                    first_line INTEGER NOT NULL, last_line INTEGER NOT NULL);
                CREATE VIRTUAL TABLE IF NOT EXISTS search USING fts5(chunk_id UNINDEXED, terms);
                CREATE TABLE IF NOT EXISTS prompts (
                    version INTEGER PRIMARY KEY, body TEXT NOT NULL, created TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS import_state (id INTEGER PRIMARY KEY CHECK(id=1), receipt TEXT NOT NULL);
            """)
            if "source_date" not in {row[1] for row in db.execute("PRAGMA table_info(documents)")}:
                db.execute("ALTER TABLE documents ADD COLUMN source_date TEXT NOT NULL DEFAULT ''")
            if not db.execute("SELECT 1 FROM prompts LIMIT 1").fetchone():
                db.execute("INSERT INTO prompts VALUES (1, ?, ?)", (
                    (APP / "prompts/grounded-answer-v1.txt").read_text(encoding="utf-8"), self.now()))

    @staticmethod
    def now():
        return datetime.now(timezone.utc).isoformat()

    @contextmanager
    def db(self):
        db = sqlite3.connect(self.path, timeout=15)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    def add(self, name, text, connection=None):
        if not isinstance(name, str) or not isinstance(text, str):
            raise ValueError("ファイル名と本文を確認してね。")
        if Path(name).name != name or any(c in name for c in "\\/\x00\r\n") or len(name) > 160:
            raise ValueError("ファイル名を確認してね。")
        if Path(name).suffix.lower() not in EXTENSIONS:
            raise ValueError("UTF-8のテキスト・Markdown・CSV・TSV・JSONを選んでね。")
        text = text.lstrip("\ufeff").replace("\r\n", "\n")
        if not text.strip() or len(text) > MAX_TEXT or "\x00" in text:
            raise ValueError("本文は空でない50万文字以内のテキストにしてね。")
        document_id = hashlib.sha256((name + "\0" + text).encode()).hexdigest()
        with (nullcontext(connection) if connection is not None else self.db()) as db:
            if db.execute("SELECT 1 FROM documents WHERE id=?", (document_id,)).fetchone():
                return document_id
            if db.execute("SELECT count(*) FROM documents").fetchone()[0] >= 500:
                raise ValueError("試用版の上限は500資料。不要な資料を削除してね。")
            source_date = re.search(r"\d{4}-\d{2}-\d{2}", name) if name.startswith("SOL-") else None
            db.execute("INSERT INTO documents(id,name,body,created,source_date) VALUES (?,?,?,?,?)",
                       (document_id, name, text, self.now(), source_date[0] if source_date else ""))
            for start in range(0, len(text), 880):
                body = text[start:start + 1000]
                first_line = text.count("\n", 0, start) + 1
                last_line = first_line + body.count("\n")
                cursor = db.execute("INSERT INTO chunks(document_id,body,first_line,last_line) VALUES (?,?,?,?)",
                                    (document_id, body, first_line, last_line))
                db.execute("INSERT INTO search(chunk_id,terms) VALUES (?,?)", (cursor.lastrowid, " ".join(tokens(body))))
        return document_id

    def replace_snapshot(self, documents, receipt):
        """Replace a dedicated workspace atomically, including records removed at source."""
        if receipt.get("complete") is not True:
            raise ValueError("取得が完了した資料だけを置換できるよ。")
        with self.db() as db:
            db.execute("DELETE FROM search")
            db.execute("DELETE FROM chunks")
            db.execute("DELETE FROM documents")
            for name, text in documents:
                self.add(name, text, connection=db)
            db.execute("INSERT OR REPLACE INTO import_state VALUES (1,?)", (json.dumps(receipt, ensure_ascii=False),))

    def snapshot(self):
        with self.db() as db:
            row = db.execute("SELECT receipt FROM import_state WHERE id=1").fetchone()
            return json.loads(row[0]) if row else None

    def documents(self):
        with self.db() as db:
            return [dict(row) for row in db.execute(
                "SELECT id,name,length(body) AS characters,created FROM documents ORDER BY created DESC,name")]

    def document(self, document_id):
        with self.db() as db:
            row = db.execute("SELECT id,name,body FROM documents WHERE id=?", (document_id,)).fetchone()
            if not row:
                raise ValueError("資料が見つからないよ。")
            return dict(row)

    def delete(self, document_id):
        with self.db() as db:
            db.execute("DELETE FROM search WHERE chunk_id IN (SELECT id FROM chunks WHERE document_id=?)", (document_id,))
            db.execute("DELETE FROM chunks WHERE document_id=?", (document_id,))
            db.execute("DELETE FROM documents WHERE id=?", (document_id,))

    def find(self, question, limit=4):
        query_tokens = tokens(question)[:80]
        if not query_tokens:
            return []
        query = " OR ".join('"' + item + '"' for item in query_tokens)
        with self.db() as db:
            managed = db.execute("SELECT 1 FROM documents WHERE name LIKE 'SOL-%' LIMIT 1").fetchone()
            kind = next((label for label in ("会議", "工程", "課題", "対応") if label in question), None) if managed else None
            recent = bool(re.search(r"最近|直近|最新|今月|現時点|現在|今の", question))
            kind_clause = " AND d.name LIKE ?" if kind else ""
            ordering = "d.source_date DESC,rank,c.id" if recent else "rank,c.id"
            parameters = [query] + ([f"SOL-{kind}-%"] if kind else []) + [limit]
            rows = db.execute("""
                SELECT c.id,c.document_id,c.body,c.first_line,c.last_line,d.name,bm25(search) AS rank
                FROM search JOIN chunks c ON c.id=search.chunk_id JOIN documents d ON d.id=c.document_id
                WHERE search MATCH ?
            """ + kind_clause + " ORDER BY " + ordering + " LIMIT ?", parameters).fetchall()
            return [dict(row) for row in rows]

    def prompt(self):
        with self.db() as db:
            return dict(db.execute("SELECT version,body,created FROM prompts ORDER BY version DESC LIMIT 1").fetchone())

    def save_prompt(self, body):
        if not isinstance(body, str) or not 50 <= len(body) <= 8000:
            raise ValueError("回答ルールは50〜8000文字にしてね。")
        with self.db() as db:
            db.execute("INSERT INTO prompts SELECT COALESCE(MAX(version),0)+1,?,? FROM prompts", (body, self.now()))


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class LocalModel:
    def __init__(self):
        # Never honor system proxy settings, arbitrary URLs, redirects, or provider credentials.
        self.transport = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())

    def call(self, path, payload=None, timeout=120):
        body = json.dumps(payload, ensure_ascii=False).encode() if payload is not None else None
        request = urllib.request.Request(OLLAMA_URL + path, data=body, headers={"Content-Type": "application/json"})
        try:
            with self.transport.open(request, timeout=timeout) as response:
                raw = response.read(4_000_001)
                if len(raw) > 4_000_000:
                    raise ValueError("AIの返答が大きすぎるため停止したよ。")
                return json.loads(raw)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            raise RuntimeError("このPCのAIに接続できなかったよ。起動状態を確認してね。") from error

    def ready(self):
        try:
            models = self.call("/api/tags", timeout=2).get("models", [])
            return any(model.get("name") == MODEL for model in models)
        except RuntimeError:
            return False

    def answer(self, question, sources, prompt):
        schema = {"type": "object", "properties": {
            "answer": {"type": "string"}, "citations": {"type": "array", "items": {"type": "integer"}}},
            "required": ["answer", "citations"], "additionalProperties": False}
        evidence = [{"source": i + 1, "name": row["name"], "lines": [row["first_line"], row["last_line"]],
                     "text": row["body"]} for i, row in enumerate(sources)]
        result = self.call("/api/chat", {"model": MODEL, "stream": False, "think": False,
            "messages": [{"role": "system", "content": prompt}, {"role": "user", "content":
                json.dumps({"question": question, "untrusted_sources": evidence}, ensure_ascii=False)}],
            "format": schema, "options": {"temperature": 0, "num_ctx": 8192, "num_predict": 900}, "keep_alive": "5m"})
        try:
            output = json.loads(result["message"]["content"])
            answer, citations = output["answer"], output["citations"]
            if not isinstance(answer, str) or not answer.strip() or not isinstance(citations, list):
                raise ValueError()
            if any(type(i) is not int or i < 1 or i > len(sources) for i in citations):
                raise ValueError()
            if not citations:
                answer = "取り込んだ資料からは確認できないよ。別の資料を追加するか、質問を具体的にしてね。"
            return {"answer": answer, "sources": [{**sources[i - 1], "citation": i} for i in dict.fromkeys(citations)],
                    "elapsed_seconds": round(result.get("total_duration", 0) / 1e9, 2), "review_required": True}
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
            raise RuntimeError("出典を確認できる形式で回答できなかったよ。質問を短くして試してね。") from error


class AppServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, port, store, model=None):
        super().__init__(("127.0.0.1", port), Handler)
        self.store = store
        self.stores = {"demo": store, "sol": Store(store.path.parent / "sol")}
        self.model = model or LocalModel()
        self.token = secrets.token_urlsafe(32)
        self.inference_lock = threading.Lock()
        self.refresh_lock = threading.Lock()


class Handler(BaseHTTPRequestHandler):
    server_version = "AmieLocal/0.1"

    def log_message(self, *_args):
        pass  # Do not log questions, document bodies, names, URLs, or model answers.

    def workspace(self):
        name = self.headers.get("X-Amie-Workspace", "demo")
        if name not in self.server.stores:
            raise ValueError("対象の資料を選んでね。")
        return name, self.server.stores[name]

    def send(self, status, data, content_type="application/json; charset=utf-8", nonce=None):
        body = data if isinstance(data, bytes) else json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "default-src 'none'; connect-src 'self'; "
                         f"script-src 'nonce-{nonce or 'none'}'; style-src 'nonce-{nonce or 'none'}'; "
                         "base-uri 'none'; form-action 'self'; frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(body)

    def permitted(self, api=False):
        port = self.server.server_port
        allowed = {f"127.0.0.1:{port}", f"localhost:{port}"}
        if self.headers.get("Host") not in allowed:
            return False
        origin = self.headers.get("Origin")
        if origin and origin not in {"http://" + host for host in allowed}:
            return False
        return not api or secrets.compare_digest(self.headers.get("X-Amie-Token", ""), self.server.token)

    def do_GET(self):
        path = urllib.parse.urlsplit(self.path)
        if not self.permitted(api=path.path.startswith("/api/")):
            return self.send(403, {"error": "このPCの専用画面から操作してね。"})
        try:
            if path.path == "/":
                nonce = secrets.token_urlsafe(24)
                html = (APP / "index.html").read_text(encoding="utf-8")
                html = html.replace("__NONCE__", nonce).replace("__TOKEN__", self.server.token)
                return self.send(200, html.encode(), "text/html; charset=utf-8", nonce)
            if path.path == "/api/status":
                workspace, store = self.workspace()
                return self.send(200, {"model_ready": self.server.model.ready(), "model": MODEL,
                    "mode": "local-only", "cloud_fallback": False, "automatic_sync": False,
                    "workspace": workspace, "snapshot": store.snapshot()})
            if path.path == "/api/documents":
                return self.send(200, {"documents": self.workspace()[1].documents()})
            if path.path == "/api/document":
                return self.send(200, self.workspace()[1].document(urllib.parse.parse_qs(path.query).get("id", [""])[0]))
            if path.path == "/api/prompt":
                return self.send(200, self.workspace()[1].prompt())
            return self.send(404, {"error": "見つからないよ。"})
        except ValueError as error:
            return self.send(400, {"error": str(error)})

    def do_POST(self):
        if not self.permitted(api=True):
            return self.send(403, {"error": "このPCの専用画面から操作してね。"})
        if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
            return self.send(415, {"error": "送信形式を確認してね。"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= MAX_BODY or self.headers.get("Transfer-Encoding"):
                return self.send(413, {"error": "資料が大きすぎるよ。小さく分けてね。"})
            payload = json.loads(self.rfile.read(length))
            if not isinstance(payload, dict):
                raise ValueError("入力を確認してね。")
            workspace, store = self.workspace()
            if self.path == "/api/refresh-sol":
                if workspace != "sol":
                    raise ValueError("対象にSOLを選んでね。")
                from setup_runtime import runtime_root
                configuration = runtime_root() / "connectors.json"
                if not configuration.exists():
                    raise ValueError("SOLの読取り接続が未設定だよ。")
                config = json.loads(configuration.read_text(encoding="utf-8-sig"))
                env_file = Path(config.get("sol_env_file", ""))
                if not env_file.is_file() or env_file.name not in {".env.local", ".env.production.local"}:
                    raise ValueError("SOLの読取り設定を確認してね。")
                if not self.server.refresh_lock.acquire(blocking=False):
                    return self.send(429, {"error": "SOL情報を取得中だよ。少し待ってね。"})
                try:
                    flags = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
                    result = subprocess.run([sys.executable, str(APP / "import_sol.py"), "--env-file", str(env_file)],
                        capture_output=True, timeout=180, creationflags=flags)
                    if result.returncode:
                        raise RuntimeError("SOL情報を取得できなかったよ。前回の資料を保持しているよ。")
                    return self.send(200, {"snapshot": store.snapshot()})
                except subprocess.TimeoutExpired as error:
                    raise RuntimeError("SOL情報の取得が時間内に終わらなかったよ。少し待って試してね。") from error
                finally:
                    self.server.refresh_lock.release()
            if self.path == "/api/documents":
                if workspace != "demo":
                    return self.send(403, {"error": "SOLは取得済みOS情報の読取り専用だよ。"})
                document_id = store.add(payload.get("name"), payload.get("text"))
                return self.send(200, {"id": document_id})
            if self.path == "/api/delete":
                if workspace != "demo":
                    return self.send(403, {"error": "SOLは取得済みOS情報の読取り専用だよ。"})
                if not isinstance(payload.get("id"), str):
                    raise ValueError("資料を選んでね。")
                store.delete(payload["id"])
                return self.send(200, {"deleted": True})
            if self.path == "/api/prompt":
                store.save_prompt(payload.get("body"))
                return self.send(200, {"saved": True})
            if self.path == "/api/ask":
                question = payload.get("question")
                if not isinstance(question, str) or not 2 <= len(question.strip()) <= 1500:
                    raise ValueError("質問は2〜1500文字にしてね。")
                sources = store.find(question)
                if not sources:
                    return self.send(200, {"answer": "関連する資料が見つからなかったよ。資料を追加してね。", "sources": []})
                if not self.server.inference_lock.acquire(blocking=False):
                    return self.send(429, {"error": "別の質問を処理中だよ。少し待って試してね。"})
                try:
                    result = self.server.model.answer(question, sources, store.prompt()["body"])
                    return self.send(200, result)
                finally:
                    self.server.inference_lock.release()
            return self.send(404, {"error": "見つからないよ。"})
        except (ValueError, UnicodeDecodeError) as error:
            return self.send(400, {"error": str(error) if not isinstance(error, json.JSONDecodeError) else "入力を確認してね。"})
        except RuntimeError as error:
            return self.send(503, {"error": str(error)})
        except Exception:
            return self.send(500, {"error": "処理できなかったよ。資料と起動状態を確認してね。"})


def main():
    from setup_runtime import runtime_root
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, default=runtime_root() / "data")
    parser.add_argument("--port", type=int, default=17840)
    args = parser.parse_args()
    server = AppServer(args.port, Store(args.data_dir))
    print(f"Amie local assistant ready on http://127.0.0.1:{server.server_port}; documents and questions are not logged.", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
