# XRL根拠 (L2 ⑧) — 設計の正本

最終更新: 2026-06-02
正本ステータス: 定義確定。通常経路は月末 checklist audit。

> **manual / spec / bzm 3層分割中**: L2⑧ XRL 根拠の確定実装仕様は `/spec/3-5-xrl-evidence-current-spec.md` へ移行済み。移行完了までは、この design も設計議論・履歴として残し、迷う内容は両方に置く。

---

## 定義

**XRL根拠** は、AMD Score / XRL 算定に使う構造化された観測根拠。

最終スコアそのものではなく、「なぜその TRL / BRL / GRL / SRL / HRL と見たか」を説明できる根拠データを L2 として保持する。

2026-06-02 のまさ判断で、通常経路は「日次で XRL 根拠候補を貯める」ではなく、**月末に L2① monthly_reports を作成した直後、月次報告書 + Supabase 内L2断面を `pwa/src/lib/xrl-level-definitions.ts` のチェック項目へ照合する XRL checklist audit** に変更した。XRL は数ヶ月から年単位で変わる成熟度指標なので、daily collector は通常運用から外す。

`project_founding_members` はこの L2 の一部で、HRL 推定の根拠として正式採用する。
ここに入れるのは CEO候補 / 技術リード / PI / AMD伴走 / 大学キーパーソンなど、SU 立ち上げに直接コミットする人物だけで、
VC / 協業先 / 顧客 / 行政 / advisor-only の人物は含めない。

---

## 対象軸

| 軸 | 意味 | 根拠例 |
|---|---|---|
| TRL | Technology Readiness Level | 技術実証、PoC、論文、特許、試作品、実験結果、技術課題 |
| BRL | Business Readiness Level | 顧客候補、用途仮説、価格、競合、事業計画、PoC候補 |
| GRL | Governance / Grant / Government Readiness Level | 補助金、規制、大学内承認、産連/URA、認定制度、公共調達 |
| SRL | Social / Stakeholder Readiness Level | ステークホルダー合意、導入先、社会実装経路、受容性、倫理・安全 |
| HRL | Human Readiness Level | CEO候補、PI、事業責任者候補、外部 founder、AMD伴走体制、採用候補 |

軸名の細部は AMD Score 側の定義に従う。ここでは「XRL 算定の根拠を束ねる L2」として扱う。

---

## 既存テーブルとの対応

| テーブル | L2 ⑧での位置づけ |
|---|---|
| `project_founding_members` | HRL 根拠。SU 創業候補 / AMD伴走者 / 大学キーパーソンを保持。manual 上は「関連メンバー」と呼ぶ |
| `amd_score_inputs.xrl_checklist` | XRL チェック項目の確認状態。スコア詳細UIの正本 |
| `amd_score_inputs.xrl_notes` | チェック / XRL 入力値の根拠 notes |
| `project_xrl_log` | XRL 時系列の評価ログ。LLM proposal や bottleneck を保持 |
| `project_xrl_evidence` | 強いイベント根拠や過去 confirmed 根拠を残す例外ログ。通常daily出力ではない |
| `l2_notifications` | checklist 更新候補、または例外的 XRL根拠の承認カード |

---

## 例外ログテーブル

`project_xrl_evidence`

推奨カラム:

| column | 意味 |
|---|---|
| `evidence_id` | UUID PK |
| `project_id` | 対象 PJ |
| `ym` | 対象年月。PJ全体根拠なら NULL |
| `axis` | `trl` / `brl` / `grl` / `srl` / `hrl` |
| `evidence_kind` | `founding_member` / `technical_validation` / `customer_signal` / `grant_signal` / `governance_signal` / `stakeholder_signal` / `team_signal` / `other` |
| `summary` | 根拠の短い要約 |
| `structured_value_json` | 根拠の構造化値 |
| `source_refs_json` | 5生データや既存L2への参照。全文ではなく source id / date / snippet / hash |
| `confidence` | 0-1 |
| `status` | `candidate` / `confirmed` / `rejected` / `archived` |
| `created_by` | `automation` / `codex` / `manual` |
| `created_at` | 作成日時 |
| `confirmed_at` | 確認日時 |

重複回避キーは `project_id + axis + evidence_kind + source_hash` を基本にする。

---

## 抽出元

通常入力は L2① monthly_reports と Supabase 内L2断面。5生データは月次断面の coverage が薄いときの明示 fallback。

- Gmail
- Google Drive
- Google Calendar
- Slack
- Notion
- 既存 L2: `monthly_reports`, `project_meeting_summaries`, `project_knowledge`, `member_activities`, `project_founding_members`

GAS バックアップシートは正本ではない。人間確認用・非常時確認用として扱い、リアルタイム抽出の source of truth にはしない。

---

## 通知ルール

XRL checklist audit でチェック状態や notes の更新候補が出たら `/notifications` などの review surface に出す。例外的に `project_xrl_evidence` を作った場合も `/notifications` に出す。

- `l2_kind = 'xrl_evidence'`
- `target_id = project_id`
- `scope_key = ym` または `global`
  - 1通知1候補にしたい場合は `202605:sx-miura-finechem-brl` のような `YYYYMM:<slug>` を許可する。
  - ただし正本 `project_xrl_evidence.scope_key` は generated column で `ym` 由来 (`202605`) になるため、UI/APIは `YYYYMM` 部分 + `metadata_json.axis/evidence_kind/evidence_source_hash` で候補行を特定する。
- summary は「どの軸の根拠が増えたか」「XRL/AMD Score にどう効くか」を短く書く
- 全文は載せず、根拠 snippet と source refs を載せる

まさが「はい」を押した場合は checklist 更新候補を `amd_score_inputs.xrl_checklist` / `xrl_notes` へ反映する。例外的な `project_xrl_evidence` 候補は `confirmed` に昇格する。

まさが「いいえ」またはコメントした場合は、`l2_feedbacks` / つくよみ学習リストへ保存し、次回抽出の抑制・修正に使う。

---

## 関連メンバー (旧 founding_members) の扱い

`project_founding_members` は L2 ⑧ XRL根拠の正式な一部で、**HRL 評価のベース**となる関連メンバー台帳。

### 対象範囲 (まさ判断 2026-05-22)

HRL 根拠に算入するのは **「該当SUの社員 (社員候補 / 創業候補を含む) + AMD の伴走メンバー + 大学キーパーソン」**。
このスコープに合致するものだけが HRL を動かす。

含める (category 値):
- `amd`: AMD の伴走メンバー (= `members.code_name` に一致する人物)
- `startup`: 該当SU の社員 / 社員候補 / 創業候補 (= AMD 外で SU 側に入る人物)
- `university`: 起源PI / 共同創業者 / 技術リード / 共同研究中核として SU と一体で動く大学・研究機関人物

含めない (category 値、status='invalid' 化 / HRL 算定から除外):
- `vc`: VC / ファンド / 投資家 / 出資検討者
- `partner_company`: 産業パートナー / 顧客候補 / サプライヤー / 委託先
- `government`: 補助金 / 行政 / 支援機関 / 採択担当
- `individual`: 個人 (フリーランス等で SU+AMD 外)

「協業」「窓口」「相談」「アドバイザ」など曖昧な関与はすべて除外する。

### 表記ルール

- AMD メンバーは必ず `members.code_name` で記録する (例: DB の `members.code_name` に存在する値)。
  本名 (`山地正洋`) / 姓のみ (`山地`) / スペース付き表記は invalid 化して `code_name` 1 行に集約する。
- 関連メンバー抽出cronが読む md は、`/Users/masa/projects/knowledge/<slug>.md` を
  `project_ventures.master_md_text` に同期した SU 別正本。AMD メンバー一覧 md は抽出promptへ直接渡さず、
  `members.code_name` + `members.member_name` をDBから読んで alias map を作る。
- AMD code_name に該当しない person で SU 側人物は `category='startup'` + `affiliation=<SU名>`。
  「JOYCLE / AMD」のような AMD 二重表記は使わない (= 誤分類の温床になる)。
- 同一人物の別表記 (例: `野田` / `野田先生`) は LLM 抽出時に集約する。
- 詳細な category / role / FRL 6 因子の式は [`../manual/4-4-frl-related-members-score-spec.md`](../manual/4-4-frl-related-members-score-spec.md) を正本にする。

### ステータス遷移

LLM 抽出は `status='tentative'` で保存。`/notifications` から「はい」で `active`、「いいえ」で `invalid`。
コックピットの関連メンバーモーダル (`CockpitMembersModal`) からつくよみ修正依頼を出すと、
`/api/founding-members/revise` が提案 → OK確定で upsert / invalid 化。

### HRL は関連メンバーだけで決めない

`project_founding_members` は HRL の主要根拠だが、HRL 自体は次の要素も合わせて決める:
- 関連メンバーの役割充足度 (CEO / 技術 / 事業 が揃っているか)
- 該当SU + AMD 両カテゴリの多様性
- 創業候補の実在性 / コミットメント / 採用候補 / 業務委託候補
- チームの意思決定速度や実行継続性

L2 ⑧ XRL根拠は HRL だけでなく TRL / BRL / GRL / SRL の根拠 (`project_xrl_evidence`) も含む。
