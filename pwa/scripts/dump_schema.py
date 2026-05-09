"""
Supabase Management API で information_schema.columns を SELECT して
pwa/design/db_schema.md を自動生成する。

実行: cd pwa && python3 -X utf8 scripts/dump_schema.py
出力: ../pwa/design/db_schema.md (上書き)

目的:
  Phase 4 で「列名を想像で書いてバグ」(member_activities の code_name/created_at 誤り
  → BUGS.md 参照) が頻発した。コード書く前に必ず参照する正本 md を自動生成して、
  「列名はここを必ず確認」運用にする。
"""
import os
import sys
import json
import urllib.request
import re
from datetime import datetime, timezone, timedelta

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def load_env(path='.env.local'):
    env = {}
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def supa_query(api, pat, sql):
    body = json.dumps({"query": sql}).encode('utf-8')
    req = urllib.request.Request(
        api,
        data=body,
        method='POST',
        headers={
            'Authorization': f'Bearer {pat}',
            'Content-Type': 'application/json',
            'User-Agent': 'amd-os-pwa-schema-dump/1.0',
        }
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode('utf-8'))


def main():
    env = load_env()
    pat = env.get('SUPABASE_ACCESS_TOKEN')
    url = env.get('NEXT_PUBLIC_SUPABASE_URL', '')
    if not pat:
        print("ERROR: SUPABASE_ACCESS_TOKEN missing in .env.local")
        sys.exit(1)
    m = re.search(r'https://([a-z0-9]+)\.supabase\.co', url)
    if not m:
        print(f"ERROR: cannot parse project ref from {url}")
        sys.exit(1)
    ref = m.group(1)
    api = f"https://api.supabase.com/v1/projects/{ref}/database/query"

    # 1) 全テーブルの列一覧 (public スキーマ)
    cols_sql = """
    SELECT
      table_name,
      column_name,
      data_type,
      udt_name,
      is_nullable,
      column_default,
      ordinal_position
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position;
    """
    cols = supa_query(api, pat, cols_sql)

    # 2) 各テーブルの primary key
    pk_sql = """
    SELECT
      tc.table_name,
      kc.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kc
      ON tc.constraint_name = kc.constraint_name
      AND tc.table_schema = kc.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kc.ordinal_position;
    """
    pks = supa_query(api, pat, pk_sql)

    # 3) UNIQUE 制約
    uq_sql = """
    SELECT
      tc.table_name,
      tc.constraint_name,
      string_agg(kc.column_name, ',' ORDER BY kc.ordinal_position) AS cols
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kc
      ON tc.constraint_name = kc.constraint_name
      AND tc.table_schema = kc.table_schema
    WHERE tc.constraint_type = 'UNIQUE'
      AND tc.table_schema = 'public'
    GROUP BY tc.table_name, tc.constraint_name
    ORDER BY tc.table_name, tc.constraint_name;
    """
    uqs = supa_query(api, pat, uq_sql)

    # 4) 行数 (pg_class.reltuples 概算、高速)
    counts_sql = """
    SELECT relname AS table_name, reltuples::bigint AS approx_rows
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY relname;
    """
    counts = supa_query(api, pat, counts_sql)
    count_map = {r['table_name']: int(r['approx_rows']) for r in counts}

    # 整形
    by_table = {}
    for c in cols:
        by_table.setdefault(c['table_name'], []).append(c)
    pk_map = {}
    for r in pks:
        pk_map.setdefault(r['table_name'], []).append(r['column_name'])
    uq_map = {}
    for r in uqs:
        uq_map.setdefault(r['table_name'], []).append((r['constraint_name'], r['cols']))

    jst = timezone(timedelta(hours=9))
    now_jst = datetime.now(jst).strftime("%Y-%m-%d %H:%M JST")

    out = []
    out.append("# DB Schema Reference — AMD OS Supabase\n")
    out.append("> ⚠️ **このファイルは自動生成。手動で編集しないこと。**\n")
    out.append(f"> 生成: `cd pwa && python3 -X utf8 scripts/dump_schema.py`  最終生成: {now_jst}\n")
    out.append("")
    out.append("## ⛔ 列名は想像で書かない")
    out.append("")
    out.append("`member_activities` の列名を `code_name`/`created_at`/`activity_text`/`kind` と想像で書いてバグった事故 (BUGS.md `[GAS] member_knowledge 抽出で「きよ」に他人の活動が紐付くカオス` 参照)。新規 cron / API / Edge Function 実装時は **必ずこの md を grep して列名を確認** してから select / filter / insert を書くこと。")
    out.append("")
    out.append("## 索引")
    out.append("")
    table_names = sorted(by_table.keys())
    out.append(" / ".join(f"[`{t}`](#{t.lower().replace('_', '-')})" for t in table_names))
    out.append("")
    out.append("---")
    out.append("")

    for t in table_names:
        anchor_id = t.lower().replace('_', '-')
        out.append(f"## {t}")
        out.append("")
        approx = count_map.get(t, 0)
        out.append(f"行数 (概算): {approx:,}")
        if t in pk_map:
            out.append(f"PRIMARY KEY: `{', '.join(pk_map[t])}`")
        if t in uq_map:
            for cname, cols_str in uq_map[t]:
                out.append(f"UNIQUE: `({cols_str})` (constraint: `{cname}`)")
        out.append("")
        out.append("| # | column | type | nullable | default |")
        out.append("|---|---|---|---|---|")
        for c in by_table[t]:
            dt = c['udt_name'] or c['data_type']
            null = "NULL" if c['is_nullable'] == 'YES' else "NOT NULL"
            default = c['column_default'] or ""
            # default を 1 行に収める
            default = default.replace("\n", " ").strip()
            if len(default) > 60:
                default = default[:57] + "..."
            out.append(f"| {c['ordinal_position']} | `{c['column_name']}` | `{dt}` | {null} | `{default}` |")
        out.append("")

    out_path = os.path.join(REPO_ROOT, "pwa", "design", "db_schema.md")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(out))
    print(f"✅ wrote {out_path}")
    print(f"   {len(table_names)} tables, {sum(len(by_table[t]) for t in table_names)} columns")


if __name__ == '__main__':
    main()
