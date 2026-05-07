"""
過去の生データ (Notion / Slack / Drive 等) から AMD Score の評価点 timeline を抽出して
amd_score_inputs に upsert する batch スクリプト。

使い方:
    python -X utf8 scripts/extract_amd_score_from_l2.py <project_id> <raw_text_file>

例:
    python -X utf8 scripts/extract_amd_score_from_l2.py p11 /tmp/amd-l2-extract/p11_bwe_raw.txt

動作:
1. raw_text_file を全文読み込み
2. Anthropic API (Sonnet 4.5) に渡して timeline JSON を抽出させる
3. JSON を amd_score_inputs に upsert する SQL を生成して Supabase Management API で適用

prerequisites:
- ANTHROPIC_API_KEY が .env.local にあること
- SUPABASE_ACCESS_TOKEN (sbp_…) が .env.local にあること
- NEXT_PUBLIC_SUPABASE_URL (project ref を抽出する) が .env.local にあること
"""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.request
import urllib.error


SYSTEM_PROMPT = """あなたは AMD OS (Before Zero Theory v3.2) の AMD Score を生データから抽出する専門家。

# AMD Score 7 軸 (各 0-9)
- σ_SU は μ_A (学術), μ_I (産業), μ_G (政府) から自動算出される: σ_SU = ((μ_A+1)(μ_I+1)(μ_G+1))^(1/3) - 1
- TRL: 技術成熟度 (NASA / 内閣府 SIP 9 段階互換)
- BRL: Business Readiness — 事業仮説 → 顧客IV → PoC → 有償 PoC → 本契約 → リピート → 拡大期
- GRL: Governance — 規制マップ → ヒアリング → 認可申請 → 取得 → 標準化
- SRL: Social — 受容性調査 → 社会実装試行 → メディア → ファン化 → 業界アライアンス → 政策影響
- HRL: Human Resources — 発案者単独 → コア参画 → 技術リード → 事業リード → 管理体制 → 営業組織 → 後継育成
- FRL: Founder Readiness — CEO 候補識別 → ALQ ベース基礎 → チーム内信頼 → 投資家信頼 → 業界認知 → 社会的影響力

# FRL の構成 (Walumbwa 2008 ALQ 4 次元、各 0-9)
- alq_self_awareness: 自己認識 (自分の強み弱み・価値観の理解)
- alq_relational_transparency: 関係透明性 (本音と建前の一致、誠実性)
- alq_balanced_processing: 均衡的処理 (反対意見を含む情報の客観評価)
- alq_internalized_moral: 内在化された道徳観 (倫理基準への一貫性)
- frl_notes: 自由記述 (ALQ で拾えない要素 — 過去 SU 経験、Founder Network、外部評価など)

# Shallow Tech モード
- 自社独自技術がなく、他社既存技術を IoT 化 / SaaS 化するパターン → trl=null, shallow_tech_mode=true

# あなたのタスク
渡される生データ (Notion ページ / Slack 抜粋 / 沿革 等) を読んで、
**期間中の主要なマイルストーンごとに評価点 (timeline)** を打つ。

# Timeline 評価点の選び方 (4-8 個程度を目安)
- AMD 関与開始時 (アルマダ参画前/後)
- 設立日 (Before 0 → After 0 の境界)
- 主要な資金調達タイミング (SIP 採択 / Pre-Seed / Seed)
- 重要な PoC milestone (PoC#1 完了 etc)
- メディア露出ピーク
- CEO 移譲 / 経営体制変更
- (将来予定) シリーズ A 等

# 出力フォーマット (厳密に JSON、他の文字一切禁止)
```
{
  "project_id": "<同じ project_id>",
  "timeline": [
    {
      "evaluated_at": "YYYY-MM-DD",
      "mu_A": 0-9,
      "mu_I": 0-9,
      "mu_G": 0-9,
      "trl": 0-9 or null,
      "brl": 0-9,
      "grl": 0-9,
      "srl": 0-9,
      "hrl": 0-9,
      "frl": 0-9,
      "alq_self_awareness": 0-9 or null,
      "alq_relational_transparency": 0-9 or null,
      "alq_balanced_processing": 0-9 or null,
      "alq_internalized_moral": 0-9 or null,
      "frl_notes": "<ALQ で拾えない FRL 要素、過去経験等>",
      "shallow_tech_mode": false,
      "notes": "<このタイミングを選んだ理由 + 主要根拠 1-2 行>"
    },
    ...
  ],
  "summary": "<全体の動向 2-3 行>",
  "uncertainty": "<不確実性が高い軸 / 推定根拠が弱い箇所>"
}
```

# 評価の guideline
- 過大評価しない (あくまで現実の readiness を測る)
- 不明な軸は前後評価点と同じか、わずかに変化させる
- 設立前 (Before 0) は HRL/BRL/FRL 低め、μ_G が立ち上がっていれば σ_SU は中程度
- 設立直後は HRL/FRL がジャンプアップ
- 主要な funding event 後は BRL + 1, σ_SU + 0.5 程度
- メディア大量露出後は SRL +1〜2
- CEO 移譲過渡期は FRL 一時低下リスク (新 CEO の ALQ が未確定なので alq_* を low-mid にしておく)
"""


def load_env(path: str = ".env.local") -> dict[str, str]:
    env: dict[str, str] = {}
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            v = v.strip().strip('"').strip("'")
            # ファイル内に literal \r \n がエスケープされて入っているケース対応
            v = v.replace("\\r", "").replace("\\n", "").strip()
            env[k.strip()] = v
    return env


def call_anthropic(api_key: str, system: str, user_text: str) -> dict:
    body = json.dumps({
        "model": "claude-sonnet-4-5-20250929",
        "max_tokens": 8000,
        "system": system,
        "messages": [{"role": "user", "content": user_text}],
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        method="POST",
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


def extract_json_from_response(resp: dict) -> dict:
    content_blocks = resp.get("content", [])
    text = "".join(b.get("text", "") for b in content_blocks if b.get("type") == "text")
    # コードフェンス内 JSON を取り出す
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if m:
        return json.loads(m.group(1))
    # 素の JSON を取り出す (最初の { から最後の } まで)
    s = text.find("{")
    e = text.rfind("}")
    if s == -1 or e == -1:
        raise ValueError(f"no JSON found in LLM response:\n{text}")
    return json.loads(text[s : e + 1])


def to_sql(project_id: str, timeline: list[dict]) -> str:
    """timeline を amd_score_inputs に upsert する SQL を生成"""
    stmts = []
    for r in timeline:
        evaluated = r["evaluated_at"]
        # null 許容な数値
        def n(k: str):
            v = r.get(k)
            return "NULL" if v is None else f"{float(v):.2f}"
        # 文字列 (シングルクォート escape)
        def s(k: str):
            v = r.get(k)
            if v is None:
                return "NULL"
            return "'" + str(v).replace("'", "''") + "'"
        shallow = "TRUE" if r.get("shallow_tech_mode") else "FALSE"
        stmts.append(f"""INSERT INTO amd_score_inputs (
  project_id, evaluated_at,
  mu_A, mu_I, mu_G,
  trl, brl, grl, srl, hrl, frl,
  alq_self_awareness, alq_relational_transparency, alq_balanced_processing, alq_internalized_moral,
  frl_notes,
  shallow_tech_mode, evaluator, notes
) VALUES (
  '{project_id}', '{evaluated}T00:00:00Z',
  {n("mu_A")}, {n("mu_I")}, {n("mu_G")},
  {n("trl")}, {n("brl")}, {n("grl")}, {n("srl")}, {n("hrl")}, {n("frl")},
  {n("alq_self_awareness")}, {n("alq_relational_transparency")}, {n("alq_balanced_processing")}, {n("alq_internalized_moral")},
  {s("frl_notes")},
  {shallow}, 'l2_extract_sonnet', {s("notes")}
)
ON CONFLICT (project_id, evaluated_at) DO UPDATE SET
  mu_A = EXCLUDED.mu_A, mu_I = EXCLUDED.mu_I, mu_G = EXCLUDED.mu_G,
  trl = EXCLUDED.trl, brl = EXCLUDED.brl, grl = EXCLUDED.grl, srl = EXCLUDED.srl, hrl = EXCLUDED.hrl, frl = EXCLUDED.frl,
  alq_self_awareness = EXCLUDED.alq_self_awareness,
  alq_relational_transparency = EXCLUDED.alq_relational_transparency,
  alq_balanced_processing = EXCLUDED.alq_balanced_processing,
  alq_internalized_moral = EXCLUDED.alq_internalized_moral,
  frl_notes = EXCLUDED.frl_notes,
  shallow_tech_mode = EXCLUDED.shallow_tech_mode,
  evaluator = EXCLUDED.evaluator,
  notes = EXCLUDED.notes,
  updated_at = NOW();""")
    return "\n".join(stmts)


def apply_sql(supabase_token: str, project_ref: str, sql: str) -> dict:
    api = f"https://api.supabase.com/v1/projects/{project_ref}/database/query"
    body = json.dumps({"query": sql}).encode("utf-8")
    req = urllib.request.Request(
        api,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {supabase_token}",
            "Content-Type": "application/json",
            "User-Agent": "amd-os-l2-extract/1.0",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return {"status": r.status, "body": r.read().decode("utf-8")}


def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: python -X utf8 scripts/extract_amd_score_from_l2.py <project_id> <raw_text_file>")
        sys.exit(2)
    project_id, raw_path = sys.argv[1], sys.argv[2]
    if not os.path.exists(raw_path):
        print(f"ERROR: raw file not found: {raw_path}")
        sys.exit(1)

    env = load_env()
    anth_key = env.get("ANTHROPIC_API_KEY")
    sb_token = env.get("SUPABASE_ACCESS_TOKEN")
    sb_url = env.get("NEXT_PUBLIC_SUPABASE_URL", "")
    if not anth_key or not sb_token:
        print("ERROR: ANTHROPIC_API_KEY or SUPABASE_ACCESS_TOKEN missing in .env.local")
        sys.exit(1)
    m = re.search(r"https://([a-z0-9]+)\.supabase\.co", sb_url)
    if not m:
        print(f"ERROR: cannot parse project ref from {sb_url}")
        sys.exit(1)
    project_ref = m.group(1)

    with open(raw_path, "r", encoding="utf-8") as f:
        raw_text = f.read()

    user_text = f"# project_id\n{project_id}\n\n# 生データ\n{raw_text}\n\n上記 project_id に対する AMD Score timeline を JSON で出してください。"

    print(f"[{project_id}] calling Anthropic Sonnet ...")
    resp = call_anthropic(anth_key, SYSTEM_PROMPT, user_text)
    parsed = extract_json_from_response(resp)
    timeline = parsed.get("timeline", [])
    print(f"[{project_id}] extracted {len(timeline)} evaluation points")

    # 結果を /tmp に保存 (debug 用)
    out_json = f"/tmp/amd-l2-extract/{project_id}_timeline.json"
    os.makedirs(os.path.dirname(out_json), exist_ok=True)
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(parsed, f, ensure_ascii=False, indent=2)
    print(f"[{project_id}] timeline JSON saved → {out_json}")

    print(f"\n--- summary ---\n{parsed.get('summary', '(none)')}")
    print(f"\n--- uncertainty ---\n{parsed.get('uncertainty', '(none)')}\n")

    # 各 row を pretty-print してから upsert
    for r in timeline:
        print(f"  {r['evaluated_at']}: mu=({r.get('mu_A')},{r.get('mu_I')},{r.get('mu_G')}) "
              f"xrl=({r.get('trl')},{r.get('brl')},{r.get('grl')},{r.get('srl')},{r.get('hrl')}) frl={r.get('frl')} "
              f"— {r.get('notes', '')[:60]}")

    sql = to_sql(project_id, timeline)
    sql_path = f"/tmp/amd-l2-extract/{project_id}_upsert.sql"
    with open(sql_path, "w", encoding="utf-8") as f:
        f.write(sql)
    print(f"\n[{project_id}] SQL saved → {sql_path}")

    # 適用
    print(f"[{project_id}] applying to Supabase ...")
    result = apply_sql(sb_token, project_ref, sql)
    print(f"[{project_id}] result: {result['status']}")
    print(result["body"][:500])


if __name__ == "__main__":
    main()
