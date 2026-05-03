"""
WindowsのBashで `python -c '...' > file` するとstdoutがcp932になり、
UTF-8コードポイントの一部が \\ufffd (REPLACEMENT CHARACTER) に化ける。
このスクリプトはSupabaseに既に投入されたシグナルから化けレコードを検出し、
ローカルの seed_atlas_signals.json (Write toolで書いたUTF-8正本)から
title/contentを取り直してPATCHで上書きする。

実行は必ず `python -X utf8 scripts/fix_mojibake.py` で。
"""
import sys
import os
import json
import urllib.request
import urllib.parse

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
    env = load_env()
    base = env['NEXT_PUBLIC_SUPABASE_URL']
    key = env['SUPABASE_SERVICE_ROLE_KEY']
    headers = {
        'apikey': key,
        'Authorization': f'Bearer {key}',
    }

    # 全inboxレコードを取得
    url = f"{base}/rest/v1/atlas_signals?status=eq.inbox&select=id,title,content"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as r:
        signals = json.loads(r.read().decode('utf-8'))
    print(f"Fetched {len(signals)} inbox signals from Supabase")

    # 正本ロード
    with open('scripts/seed_atlas_signals.json', 'r', encoding='utf-8') as f:
        truth = json.load(f)['signals']

    # 化け検出
    fixes = []
    for s in signals:
        title = s.get('title') or ''
        content = s.get('content') or ''
        if '\ufffd' in title or '\ufffd' in content:
            # 正本から prefix一致でマッチング (前半5-8文字は化けにくい)
            truth_match = None
            t_prefix = title[:8] if '\ufffd' not in title[:8] else title[:5]
            for tr in truth:
                if tr['title'].startswith(t_prefix.split('\ufffd')[0][:5]):
                    truth_match = tr
                    break
            if truth_match:
                fixes.append((s['id'], truth_match))
                print(f"  fix {s['id'][:8]}: {truth_match['title'][:40]}")
            else:
                print(f"  ! NO MATCH for id={s['id'][:8]} title={title[:30]!r}")

    print(f"Total {len(fixes)} signals to fix")

    # PATCH
    for sid, tr in fixes:
        body = json.dumps({
            'title': tr['title'],
            'content': tr['content'],
        }, ensure_ascii=False).encode('utf-8')
        url = f"{base}/rest/v1/atlas_signals?id=eq.{sid}"
        req = urllib.request.Request(
            url,
            data=body,
            method='PATCH',
            headers={
                **headers,
                'Content-Type': 'application/json; charset=utf-8',
                'Prefer': 'return=minimal',
            }
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                _ = r.read()
            print(f"  ok: {sid[:8]}")
        except Exception as e:
            print(f"  FAIL {sid[:8]}: {e}")


if __name__ == '__main__':
    main()
