import unittest
from unittest.mock import Mock

from import_sol import Reader, SOURCES, collect, text_value


class SolReadBoundaryTests(unittest.TestCase):
    def test_reader_rejects_other_projects_before_sending_any_request(self):
        reader = Reader("not-a-real-key")
        reader.transport = Mock()
        with self.assertRaises(ValueError):
            reader.get("project_meeting_summaries", {"project_id": "eq.p99"})
        reader.transport.open.assert_not_called()
        with self.assertRaises(ValueError):
            reader.get("private_tokens", {"project_id": "eq.p21"})
        reader.transport.open.assert_not_called()

    def test_pagination_continues_after_short_pages_until_eof(self):
        reader = Reader("not-a-real-key")
        reader.get = Mock(side_effect=[[{"id": "one"}], [{"id": "two"}], []])
        self.assertEqual(len(reader.all("project_management_tasks", {"project_id": "eq.p21"})), 2)
        self.assertEqual([call.args[2] for call in reader.get.call_args_list], [0, 1, 2])

    def test_only_reviewed_columns_and_live_records_are_requested(self):
        class FakeReader:
            def get(self, table, parameters):
                return [{"project_id": "p21", "project_name": "SOL"}]

            def all(self, table, parameters):
                if parameters["project_id"] != "eq.p21":
                    raise AssertionError("Missing project filter")
                if table != "project_meeting_summaries" and parameters.get("deleted_at") != "is.null":
                    raise AssertionError("Missing deletion filter")
                if "narrative_md" in parameters["select"] or "source_ref" in parameters["select"]:
                    raise AssertionError("Unnecessary private fields")
                primary = SOURCES[table]["primary"]
                return [{primary: "fake-source", "project_id": "p21", "title": "架空検証資料"}]
        documents, counts = collect(FakeReader(), "2026-10-26")
        self.assertEqual(len(documents), 4)
        self.assertEqual(sum(counts.values()), 4)
        self.assertTrue(all(name.startswith("SOL-") for name, _body in documents))

    def test_contacts_and_external_links_are_omitted(self):
        text = text_value("contact@example.test https://example.test/private 資料")
        self.assertNotIn("contact@", text)
        self.assertNotIn("https://", text)
        self.assertIn("資料", text)


if __name__ == "__main__":
    unittest.main()
