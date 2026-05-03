"""
Phase 4: OpenAlex から各レーン × 各年の論文数を取得して papers_log に投入。

OpenAlex は認証不要・無料。polite mode のため User-Agent に email を含める。
- API: https://api.openalex.org/works
- filter: publication_year, type
- search: キーワード OR 文字列

5 lanes × 17 years = 85 queries。1秒sleepで2-3分で完了。

実行: python3 -X utf8 scripts/fetch_papers_openalex.py
"""

import sys
import os
import json
import time
import urllib.request
import urllib.parse
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


# レーン → OpenAlex 検索クエリ
LANE_QUERIES = {
    'gx_energy':   '"hydrogen energy" OR "renewable energy" OR "solar cell" OR "next generation battery" OR "fusion energy"',
    'gx_circular': '"circular economy" OR "recycling technology" OR "carbon capture" OR "waste valorization"',
    'materials':   '"nanomaterial" OR "advanced materials" OR "thermal insulation" OR "superconductor"',
    'life':        '"drug discovery" OR "gene therapy" OR "regenerative medicine" OR "biopharmaceutical"',
    'robo':        '"robotics" OR "autonomous robot" OR "agricultural drone" OR "construction automation"',
}

YEARS = list(range(2010, 2027))


def fetch_count(query: str, year: int) -> int:
    url = (
        "https://api.openalex.org/works?"
        f"search={urllib.parse.quote(query)}"
        f"&filter=publication_year:{year},type:article"
        "&per_page=1"
    )
    req = urllib.request.Request(
        url,
        headers={'User-Agent': 'amd-os-pwa/1.0 mailto:masa@team-armada.jp'}
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read().decode('utf-8'))
            return int(data.get('meta', {}).get('count', 0))
    except Exception as e:
        print(f"  ERROR {year}: {e}")
        return 0


def post_query(env, sql: str) -> str:
    pat = env.get('SUPABASE_ACCESS_TOKEN')
    url = env.get('NEXT_PUBLIC_SUPABASE_URL', '')
    m = re.search(r'https://([a-z0-9]+)\.supabase\.co', url)
    if not pat or not m:
        raise SystemExit("ERROR: env vars missing")
    ref = m.group(1)
    api = f"https://api.supabase.com/v1/projects/{ref}/database/query"
    body = json.dumps({"query": sql}).encode('utf-8')
    req = urllib.request.Request(
        api, data=body, method='POST',
        headers={
            'Authorization': f'Bearer {pat}',
            'Content-Type': 'application/json',
            'User-Agent': 'amd-os-pwa-migrator/1.0',
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.read().decode('utf-8')
    except urllib.error.HTTPError as e:
        return f"FAIL {e.code}: {e.read().decode('utf-8')}"


def main():
    env = load_env()
    rows = []
    for lane, q in LANE_QUERIES.items():
        print(f"\n=== {lane} ===  query: {q[:60]}...")
        for year in YEARS:
            count = fetch_count(q, year)
            print(f"  {year}: {count:,}")
            rows.append((lane, year, count))
            time.sleep(0.6)  # polite

    # papers_log に投入（日付は1月1日扱い）
    values = ",\n".join(
        f"('{lane}', '{year}-01-01', {count}, 'openalex', 'lane:{lane}/year:{year}')"
        for (lane, year, count) in rows
    )
    sql = f"""
    INSERT INTO papers_log (lane, observed_at, paper_count, source, query_hash)
    VALUES
    {values}
    ;
    """
    print("\nInserting into papers_log...")
    print(post_query(env, sql)[:500])
    print(f"\nDone. {len(rows)} rows inserted.")


if __name__ == '__main__':
    main()
