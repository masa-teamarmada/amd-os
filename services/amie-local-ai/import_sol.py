"""One-shot, read-only p21 snapshot. Contents and credentials never go to stdout."""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

from server import NoRedirect, Store
from setup_runtime import runtime_root

HOST = "nbnhrhybjslbawdukvvk.supabase.co"
PROJECT = "p21"
SOURCES = {
    "project_meeting_summaries": {
        "select": "meeting_id,project_id,meeting_date,title,summary_short,decided,progress,next_actions,risks,updated_at,source_kinds",
        "order": "meeting_date.desc,meeting_id.asc", "primary": "meeting_id", "label": "会議",
        "fields": {"meeting_date": "会議日", "title": "件名", "summary_short": "要約", "decided": "決定事項",
                   "progress": "進捗", "next_actions": "次の対応", "risks": "課題", "updated_at": "OS更新日時"}},
    "project_management_milestones": {
        "select": "id,project_id,title,gate,status,planned_end,forecast_end,actual_end,progress_pct,owner_label,next_deliverable,max_issue,confidence,last_verified_at,updated_at",
        "order": "updated_at.desc,id.asc", "primary": "id", "label": "工程",
        "fields": {"title": "工程名", "gate": "達成条件", "status": "状態", "planned_end": "計画期限",
                   "forecast_end": "予測期限", "actual_end": "実績完了日", "progress_pct": "進捗率",
                   "owner_label": "担当", "next_deliverable": "次の成果物", "max_issue": "主な課題",
                   "confidence": "確度", "last_verified_at": "最終確認", "updated_at": "OS更新日時"}},
    "project_management_issues": {
        "select": "id,project_id,title,background,status,owner_label,due_date,confidence,last_verified_at,updated_at",
        "order": "updated_at.desc,id.asc", "primary": "id", "label": "課題",
        "fields": {"title": "課題名", "background": "背景", "status": "状態", "owner_label": "担当",
                   "due_date": "期限", "confidence": "確度", "last_verified_at": "最終確認", "updated_at": "OS更新日時"}},
    "project_management_tasks": {
        "select": "id,project_id,title,description,goal,next_deliverable,blocker,status,planned_end,forecast_end,actual_end,progress_pct,owner_label,confidence,last_verified_at,updated_at",
        "order": "updated_at.desc,id.asc", "primary": "id", "label": "対応",
        "fields": {"title": "対応名", "description": "内容", "goal": "目標", "next_deliverable": "次の成果物",
                   "blocker": "詰まり", "status": "状態", "planned_end": "計画期限", "forecast_end": "予測期限",
                   "actual_end": "実績完了日", "progress_pct": "進捗率", "owner_label": "担当",
                   "confidence": "確度", "last_verified_at": "最終確認", "updated_at": "OS更新日時"}},
}


def credentials(env_file):
    allowed = {"NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"}
    config = {}
    for line in env_file.read_text(encoding="utf-8-sig").splitlines():
        name, sep, value = line.partition("=")
        if sep and name.strip() in allowed:
            config[name.strip()] = value.strip().strip("\"'")
    url = config.get("NEXT_PUBLIC_SUPABASE_URL", "")
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or parsed.hostname != HOST or parsed.path not in {"", "/"} or parsed.username or parsed.port:
        raise ValueError("Expected Supabase project URL was not found. No credentials were sent.")
    if not config.get("SUPABASE_SERVICE_ROLE_KEY"):
        raise ValueError("Existing local database credential was not found.")
    return config["SUPABASE_SERVICE_ROLE_KEY"]


class Reader:
    def __init__(self, key):
        self.key = key
        self.transport = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())

    def get(self, table, parameters, offset=0):
        if table not in SOURCES and table != "projects":
            raise ValueError("Unexpected source table")
        if parameters.get("project_id") != "eq." + PROJECT:
            raise ValueError("Every read must be restricted to p21")
        query = urllib.parse.urlencode({**parameters, "limit": "250", "offset": str(offset)})
        request = urllib.request.Request(f"https://{HOST}/rest/v1/{table}?{query}",
            headers={"apikey": self.key, "Authorization": "Bearer " + self.key, "Accept": "application/json"})
        # Only GET is supported. Never copy the key into the service, model process, or output files.
        with self.transport.open(request, timeout=40) as response:
            rows = json.load(response)
        if not isinstance(rows, list) or any(not isinstance(row, dict) or row.get("project_id") != PROJECT for row in rows):
            raise ValueError("Unexpected project in response; no snapshot was saved")
        return rows

    def all(self, table, parameters):
        rows, offset = [], 0
        while True:
            page = self.get(table, parameters, offset)
            rows.extend(page)
            # Request until an empty page; do not assume the provider returned the requested page size.
            if not page:
                return rows
            offset += len(page)
            if offset > 10_000:
                raise ValueError("Source exceeds the reviewed pilot scope; no partial snapshot was saved")


def text_value(value):
    if value is None or value == "" or value == []:
        return "未登録"
    if isinstance(value, (list, dict)):
        value = json.dumps(value, ensure_ascii=False, indent=2)
    else:
        value = str(value)
    # Contact details and external links are unnecessary for this first read-only pilot.
    value = re.sub(r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", "[連絡先省略]", value)
    return re.sub(r"https?://[^\s<>\"']+", "[参照先省略]", value)


def collect(reader, today):
    project = reader.get("projects", {"project_id": "eq.p21", "select": "project_id,project_name,display_name"})
    if len(project) != 1 or not any(str(project[0].get(field, "")).lower() in {"sol", "solviorax"} for field in ("project_name", "display_name")):
        raise ValueError("SOL identity check failed")
    documents, counts, seen = [], {}, set()
    for table, spec in SOURCES.items():
        parameters = {"project_id": "eq.p21", "select": spec["select"], "order": spec["order"]}
        if table == "project_meeting_summaries":
            parameters.update({"meeting_date": "lte." + today, "or": "(source_kinds.is.null,source_kinds.neq.upcoming)"})
        else:
            parameters["deleted_at"] = "is.null"
        rows = reader.all(table, parameters)
        counts[table] = 0
        for row in rows:
            identifier = str(row[spec["primary"]])
            source_key = table + ":" + identifier
            if source_key in seen:
                raise ValueError("Duplicate source identifier; retry the read")
            seen.add(source_key)
            digest = hashlib.sha256(source_key.encode()).hexdigest()[:12]
            date = str(row.get("meeting_date") or row.get("updated_at") or today)[:10]
            name = f"SOL-{spec['label']}-{date}-{digest}.txt"
            lines = ["対象PJ: SOL / p21", "出典: AMD OSの保存済み構造化情報", "種別: " + spec["label"],
                     "この資料は取得時点の写し。最新の正式情報はAMD OSを確認する。"]
            lines.extend(f"{label}: {text_value(row.get(field))}" for field, label in spec["fields"].items())
            documents.append((name, "\n".join(lines)))
            counts[table] += 1
    if len(documents) > 500:
        raise ValueError("More than 500 records; narrow the pilot explicitly instead of truncating")
    return documents, counts


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--env-file", required=True, type=Path, help="Existing AMD OS local env file; never copied")
    args = parser.parse_args()
    try:
        key = credentials(args.env_file)
        now = datetime.now(timezone(timedelta(hours=9)))
        documents, counts = collect(Reader(key), now.date().isoformat())
        receipt = {"project": "SOL", "project_id": PROJECT, "imported_at": now.isoformat(),
                   "counts": counts, "documents": len(documents), "complete": True, "mode": "read-only-snapshot"}
        Store(runtime_root() / "data/sol").replace_snapshot(documents, receipt)
        print(json.dumps(receipt, ensure_ascii=False), flush=True)
    except (ValueError, OSError, urllib.error.URLError, KeyError) as error:
        # A provider error can contain sensitive values. Report only the exception type, never its body.
        print("SOL import stopped; previous local snapshot preserved. Error category: " + type(error).__name__, file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
