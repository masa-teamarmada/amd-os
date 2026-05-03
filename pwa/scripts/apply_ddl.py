"""
Supabase Management API で DDL を流す（えいみの仕事）。
- token は .env.local の SUPABASE_ACCESS_TOKEN
- ref は NEXT_PUBLIC_SUPABASE_URL から抽出

実行: python -X utf8 scripts/apply_ddl.py path/to/file.sql
"""
import sys
import os
import json
import urllib.request
import re

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')


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


def main():
    if len(sys.argv) < 2:
        print("Usage: python -X utf8 scripts/apply_ddl.py <sql_file>")
        sys.exit(2)

    sql_path = sys.argv[1]
    with open(sql_path, 'r', encoding='utf-8') as f:
        sql = f.read()

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
    body = json.dumps({"query": sql}).encode('utf-8')
    req = urllib.request.Request(
        api,
        data=body,
        method='POST',
        headers={
            'Authorization': f'Bearer {pat}',
            'Content-Type': 'application/json',
            'User-Agent': 'amd-os-pwa-migrator/1.0',
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            text = r.read().decode('utf-8')
        print(f"OK ({r.status})")
        print(text[:500])
    except urllib.error.HTTPError as e:
        print(f"FAIL ({e.code})")
        print(e.read().decode('utf-8'))
        sys.exit(1)


if __name__ == '__main__':
    main()
