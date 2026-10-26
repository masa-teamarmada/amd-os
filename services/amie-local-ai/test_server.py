"""Security and data-lifecycle checks; uses no external services or real documents."""
import http.client
import json
from pathlib import Path
import tempfile
import threading
import unittest

from server import AppServer, LocalModel, NoRedirect, Store


class NeverCallModel:
    def ready(self):
        return False

    def answer(self, *_args):
        raise AssertionError("Missing evidence must not invoke a model")


class LocalWorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.folder.name))

    def tearDown(self):
        self.folder.cleanup()

    def test_japanese_retrieval_and_complete_logical_deletion(self):
        first = self.store.add("first.txt", "青空プロジェクト\n試験担当は佐藤。期限は10月20日。")
        self.store.add("second.txt", "青空プロジェクト\n試験担当を鈴木に変更。期限は10月28日へ変更。")
        self.store.add("unrelated.txt", "経理の締め日は翌月5日。")
        sources = self.store.find("青空プロジェクトの試験担当と期限")
        self.assertEqual({x["name"] for x in sources}, {"first.txt", "second.txt"})
        self.assertTrue(all(x["first_line"] >= 1 for x in sources))
        self.assertEqual(first, self.store.add("first.txt", "青空プロジェクト\n試験担当は佐藤。期限は10月20日。"))
        self.store.delete(first)
        self.assertNotIn("first.txt", {x["name"] for x in self.store.find("青空プロジェクト")})
        with self.assertRaises(ValueError):
            self.store.document(first)

    def test_prompt_versions_are_saved_and_previous_versions_retained(self):
        original = self.store.prompt()
        self.store.save_prompt(original["body"] + "\n根拠の日時を明示する。")
        self.assertEqual(self.store.prompt()["version"], original["version"] + 1)
        with self.store.db() as db:
            self.assertEqual(db.execute("SELECT count(*) FROM prompts").fetchone()[0], 2)

    def test_snapshot_rollback_and_verified_empty_snapshot_removes_stale_data(self):
        self.store.add("old.txt", "青空の既存資料")
        with self.assertRaises(ValueError):
            self.store.replace_snapshot([("new.txt", "青空の新資料"), ("invalid.pdf", "binary")], {"complete": True})
        self.assertEqual([row["name"] for row in self.store.documents()], ["old.txt"])
        with self.assertRaises(ValueError):
            self.store.replace_snapshot([], {"complete": False})
        self.store.replace_snapshot([], {"complete": True})
        self.assertEqual(self.store.documents(), [])
        self.assertEqual(self.store.find("青空"), [])

    def test_latest_meeting_uses_source_date_and_excludes_other_kinds(self):
        for name, body in [("SOL-会議-2026-09-01-a.txt", "会議での決定。古い情報。"),
                           ("SOL-会議-2026-10-20-b.txt", "会議での決定。新しい情報。"),
                           ("SOL-課題-2026-10-26-c.txt", "会議の課題に関する別の情報。")]:
            self.store.add(name, body)
        found = self.store.find("直近の会議での決定")
        self.assertEqual(found[0]["name"], "SOL-会議-2026-10-20-b.txt")
        self.assertTrue(all("SOL-会議-" in row["name"] for row in found))

    def test_paths_binary_and_unsupported_documents_are_rejected(self):
        for name, body in [("../secret.txt", "hello"), ("C:\\private.txt", "hello"), ("doc.pdf", "hello"),
                           ("doc.txt", "binary\0data"), ("doc.txt", " ")]:
            with self.subTest(name=name), self.assertRaises(ValueError):
                self.store.add(name, body)

    def test_out_of_range_citations_and_unsupported_answer_are_rejected(self):
        model = LocalModel()
        model.call = lambda *_a, **_k: {"message": {"content": json.dumps({"answer": "made up", "citations": [99]})}}
        with self.assertRaises(RuntimeError):
            model.answer("期限", [{"name": "test", "first_line": 1, "last_line": 1, "body": "期限未定"}], "test")
        model.call = lambda *_a, **_k: {"message": {"content": json.dumps({"answer": "made up", "citations": []})}}
        self.assertNotIn("made up", model.answer("期限", [], "test")["answer"])

    def test_no_http_redirects_to_external_services(self):
        self.assertIsNone(NoRedirect().redirect_request(None, None, 302, "redirect", {}, "https://example.com"))

    def test_http_is_loopback_only_and_rejects_other_websites(self):
        app = AppServer(0, self.store, NeverCallModel())
        worker = threading.Thread(target=app.serve_forever, daemon=True)
        worker.start()
        self.assertEqual(app.server_address[0], "127.0.0.1")

        def request(method, path, payload=None, headers=None):
            connection = http.client.HTTPConnection("127.0.0.1", app.server_port, timeout=3)
            body = json.dumps(payload) if payload is not None else None
            connection.request(method, path, body, headers or {})
            response = connection.getresponse()
            result = (response.status, dict(response.getheaders()), response.read())
            connection.close()
            return result

        try:
            self.assertEqual(request("GET", "/api/documents")[0], 403)
            self.assertEqual(request("GET", "/", headers={"Host": "attacker.example"})[0], 403)
            auth = {"X-Amie-Token": app.token, "Content-Type": "application/json"}
            self.assertEqual(request("POST", "/api/documents", {"name": "x.txt", "text": "test"},
                                     {**auth, "Origin": "https://attacker.example"})[0], 403)
            status, headers, body = request("GET", "/")
            self.assertEqual(status, 200)
            self.assertEqual(headers["Cache-Control"], "no-store")
            self.assertIn("frame-ancestors 'none'", headers["Content-Security-Policy"])
            self.assertNotIn(b"__TOKEN__", body)
            status, _, body = request("POST", "/api/ask", {"question": "架空資料の期限"}, auth)
            self.assertEqual(status, 200)
            self.assertEqual(json.loads(body)["sources"], [])
            self.assertEqual(request("POST", "/api/ask", ["bad"], auth)[0], 400)
            self.store.add("demo.txt", "架空の青空資料")
            app.stores["sol"].add("SOL-会議-2026-10-20-a.txt", "SOL専用の架空検証資料")
            sol_auth = {**auth, "X-Amie-Workspace": "sol"}
            sol_documents = json.loads(request("GET", "/api/documents", headers=sol_auth)[2])["documents"]
            self.assertEqual(len(sol_documents), 1)
            self.assertNotEqual(sol_documents[0]["name"], "demo.txt")
            self.assertEqual(request("GET", "/api/document?id=" + self.store.documents()[0]["id"], headers=sol_auth)[0], 400)
            self.assertEqual(request("POST", "/api/delete", {"id": sol_documents[0]["id"]}, sol_auth)[0], 403)
            self.assertEqual(request("POST", "/api/documents", {"name": "bad.txt", "text": "test"}, sol_auth)[0], 403)
            self.assertEqual(request("GET", "/api/documents", headers={**auth, "X-Amie-Workspace": "../other"})[0], 400)
        finally:
            app.shutdown()
            worker.join(timeout=3)
            app.server_close()


if __name__ == "__main__":
    unittest.main()
