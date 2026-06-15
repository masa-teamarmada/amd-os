# OS Coverage Scanner — 不在検知 (negative space) 設計ドラフト

**ステータス**: 設計ドラフト (2026-06-15 起票)。まさ判断待ち。実装はまだしない。
**正本ステータス**: 提案中。承認後に `pwa/spec/` へ移行 + DDL + Phase 実装。

> このドキュメントは「拾うべき情報を自動で検知して候補提示する仕組み」の設計たたき台。
> 既存 D-5 OS台帳差分 ([project_registry_diffs.md](project_registry_diffs.md)) / D-14 要対応 ([governance_action_items.md](governance_action_items.md)) との境界を明記する。

---

## 0. なぜ作るか (問題の正本)

2026-06-15、まさが「あれ？このJOYCLE臨時株主総会の招集通知、コックピットに入れるべきでは？」と **自分で気づいたから**、株主・総会・決議・保有株式・バリュエーションを OS に取り込めた。

これは AMD OS の目的「**脱・属人化** (まさが判断しなくても回る)」に真っ向から反する。**まさ依存だと高確率で取りこぼす**。

JOYCLE 事故の構造 (governance_action_items.md §1):
1. **取り込み**: Gmail 抽出は `projects.report_emails` マッチ + active/進捗PJ中心。送信元 `noreply@smartround.com` は report_emails に居らず、JC は終了PJ(p09)。全フィルタをすり抜け **`source_cache` の痕跡すら残らない**。
2. **分類**: 「期日付き要対応」を入れる L2 種別が無かった。
3. **受け皿**: cockpit に株主・ガバナンス欄が無かった。

今回のセッションで (2)(3) は D-14 + governance テーブルで埋めた。だが **メタな穴は残る**:

> **OS の抽出器 (D-1〜D-14) は「自分がプログラムされたパターン」しか検知しない。どの抽出器のパターンにも一致しない情報は、痕跡すら残らず消える。**

次に来る「誰も想定していなかったカテゴリ」を取りこぼさないための、**抽出器の上位にある安全網**が要る。それが OS Coverage Scanner。

---

## 1. 設計思想 — これは「もう1個の抽出器」ではない

| | 既存の抽出器 (D-1〜D-14) | **Coverage Scanner (本設計)** |
|---|---|---|
| 動作 | 「Xパターンを見つける → X レコードを書く」(positive) | 「重要そうな生データが、OSのどのL2にも構造化されていない」を見つける (**negative space / 不在検知**) |
| 入力ゲート | report_emails / active PJ で**事前に絞る** | **ゲートを外す**。PJに紐づかなくても拾う (JOYCLE 根本原因#1 の直接対策) |
| 検知の核 | キーワード/パターン一致 | **来た生データ × 既存L2カバレッジ の差分** (補集合) |
| 出力 | 各 L2 テーブルの構造化レコード | 「OS化されていない候補」= `l2_coverage_gaps` |
| カテゴリ | 既知カテゴリに限定 | **未知カテゴリも捨てない** (分類先未確定でも残す) |

**キーワード抽出ではない**のが肝。「招集通知」という語を見つけることが目的ではなく、「この情報に対応するOSレコードが**存在しない**」ことを見つけるのが目的。

### 既存 `raw_data_gap` との関係 (重要)

OS には既に `raw_data_gap` という通知種別がある = 「L2化先・backfill経路・helper/UI が未確定なときの抽出経路確認通知」(L2_DATA.md:201)。これは Coverage Scanner の**種**だが、現状は **受動的** — 抽出器がたまたま「ルーティングできない物」に遭遇したときだけ発火する。

Coverage Scanner は、これを **能動的** にする = 「不在」を意図的にスイープして探しにいく。`raw_data_gap` を第一級の検知レイヤーに昇格させたもの、と位置づける。

---

## 2. 仕組み (検知ロジック)

### 2.1 全体フロー

```text
[5生データ]  Gmail / Drive / Calendar / Slack / Notion
     │
     ▼  (A) ungated salience sweep  ← ゲートを外した広い網
[salient items]  PJ非紐付けでも拾う。差分検知(source_hash)で当日分だけ
     │
     ▼  (B) coverage check  ← negative space の計算
   既存L2の「claimed source refs index」と突合
     ├─ 既存L2が既に表現している → covered (= 既存抽出器が拾えている。drop、coverage metricに計上)
     └─ どのL2にも無い            → GAP candidate
     │
     ▼  (C) routing suggestion  ← LLMが「本来どこに入るべきか」提案
     ├─ 既存L2にマップできる   → extractor MISS (= 抽出器が拾うべきだったのに漏れた。該当抽出器へfeedback)
     ├─ 既存にマップできない    → 構造的GAP (= OSに新しい受け皿が要るかも。設計TODO候補)
     └─ 重要だが分類先未確定    → uncertain GAP (= 捨てない。candidateのまま採否ループへ)
     │
     ▼  (D) l2_coverage_gaps (candidate) + l2_notifications(l2_kind='coverage_gap')
     │
     ▼  (E) /notifications 採否ループ
     ├─ 「これは要対応」     → action_items へルート
     ├─ 「これは株主総会」   → governance へルート
     ├─ 「これは新カテゴリ」 → 設計TODO (受け皿を作る)
     └─ 「無視」            → rejected + 学習 (類似を抑制)
```

### 2.2 (A) ungated salience sweep — ゲートを外した広い網

JOYCLE が `source_cache` の痕跡すら残らなかった真因 = 取り込み段階のゲート。Coverage Scanner はここを外す。

- **対象**: 5生データの直近 24-48h 分を、**report_emails / active PJ で絞らずに**スキャン。
- **広い網 (salience filter)**: 以下のどれかに当たるものを candidate に上げる。
  - 高価値語: 後述 §3 の検知対象パターン語。
  - 既知ベンダー送信元: `smartround.com` / `everidays.com` / `cloudsign` / `docusign` / freee / 法務局 / 特許事務所 等 (allowlist は DB 化)。
  - 期日表現を含む (「〜までに」「提出期限」「開催日時」)。
- **noise 除外**: 広告メルマガ・通知音的メール・既知の noise 送信元は salience から落とす。
- **bound**: 広い網だが、`l2_extract_state.source_hash` 相当で **当日差分のみ** に絞る + LLM triage は candidate 件数だけに走るので有界。
- 拾った salient item は (B) で使うため、PJ非紐付けでも保持する。

### 2.3 (B) coverage check — negative space の計算 (技術的核心)

「この生データは既存L2に表現されているか?」をどう判定するか。

- 各 L2 テーブルは raw への参照を持つ (`action_items.source_ref`/`source_hash`、`project_meeting_summaries`=calendar event id PK、`source_cache.text_sha256`、`project_registry_diffs.evidence_refs_json`、`contract_signals` の source refs 等)。
- これらを横断して **「claimed source refs index」** を構築する = 直近ウィンドウで、いずれかのL2が「これは拾った」と主張している raw参照 (gmail message/thread id・drive file id・calendar event id・slack ts・notion page id・content hash) の集合。
- salient item の参照キーがこの index に**無ければ** → どのL2も拾っていない = **coverage gap**。

> **二次要件 (hardening)**: この突合が効くには、各L2テーブルが `source_ref` / `source_hash` を一貫して保存している必要がある。保存していないL2は coverage check の盲点になる。実装時に各L2の source ref 保存状況を監査し、欠けているものを埋める (= 別タスク化)。

### 2.4 (C) routing suggestion — 「本来どこに入るべきか」

gap candidate ごとに LLM が `proposed_target_l2` を提案する。これが学習ループの肝:

- **既存L2にマップ** (例: action_item / registry_diff / strategy_signal / shareholder_meeting) → これは **抽出器の取りこぼし**。「拾えるはずだったのに漏れた」= 該当抽出器のプロンプト/ゲートを改善する feedback。
- **既存にマップできない** → 真の構造的 gap。OSに新しい受け皿 (テーブル/欄) が要るかもしれない = 設計TODO候補。
- **分類先未確定** → `proposed_target_l2=null` の uncertain gap。**捨てずに** candidate のまま残す (取りこぼし防止 > 分類精度)。

---

## 3. 検知対象パターン (salience の定義)

「高価値そう」の初期定義。allowlist として DB 化し、まさ + 採否ループで育てる。

| 領域 | 例 (語・signal) |
|---|---|
| 法務/ガバナンス | 株主総会・招集通知・議決権・委任状・定款変更・登記・取締役会・解散・清算 |
| 資本 | 資金調達・バリュエーション・投資契約・株主間契約・優先株・株式譲渡・新株予約権・equity |
| 契約 | 契約締結・押印依頼・クラウドサイン・基本合意・MOU・NDA・更新期限・解約・解除 |
| 事業進展 | 採択 (グラント/アクセラ)・受賞・採用通知・提携・PoC開始 |
| 関係性 | 重要関係先 (大学/行政/大企業/VC) の初登場・キーパーソンの新規接触 |
| 規制/政策 | 規制変更・公募開始・標準化・認証 |
| リスク | クレーム・訴訟・督促・退職/人事異動・資金繰り・期日超過 |
| 期日 | 締切・提出期限・振込期限・回答期限を含むもの全般 |

salience は「語が在る」だけで確定しない。語 OR 既知ベンダー送信元 OR 期日表現 で **網に上げ**、最終判定は (B) coverage check と (C) LLM triage に委ねる (= 単純キーワード抽出にしない)。

---

## 4. データモデル (新規1テーブル)

### `l2_coverage_gaps`

| 列 | 型 | 用途 |
|---|---|---|
| `gap_id` | text PK | `cg:<source_hash 先頭>` |
| `source` | text | `gmail` / `drive` / `calendar` / `slack` / `notion` |
| `source_ref` | text | gmail thread id / drive file id / event id / slack ts / notion page id |
| `source_hash` | text UNIQUE | 重複排除キー (= 当日再走で confirmed/rejected を壊さない) |
| `title` | text | 件名/タイトル |
| `summary` | text | 要約 (全文保存しない) |
| `salience_score` | numeric | 0-1 |
| `matched_patterns` | jsonb | どの検知パターンに当たったか |
| `proposed_target_l2` | text NULL | (C)の提案。`action_item`/`registry_diff`/`strategy_signal`/`shareholder_meeting`/... or NULL(未確定) |
| `gap_class` | text | `extractor_miss` (既存L2にマップ可) / `structural_gap` (受け皿なし) / `uncertain` (分類先未確定) |
| `project_id` | text NULL | 紐づくPJ (終了PJ含む)。NULL = 個人/会社/未紐付け |
| `scope` | text | `project` / `company` / `personal` / `unknown` |
| `due_at` | timestamptz NULL | 期日があれば (期日系の取りこぼしを最優先化) |
| `review_status` | text default `'candidate'` | `candidate` / `confirmed` / `rejected` |
| `routed_to` | text NULL | confirm 時に実際にルートした先 (例: `action_items:ai:xxx`) |
| `evidence_refs_json` | jsonb | source への参照 (本文全文でなく snippet/hash) |
| `created_by` | text | `coverage_scanner` |
| `detected_at` / `reviewed_at` / `routed_at` | timestamptz | |

- RLS: governance 同様、機密寄りに倒す (service_role ALL / is_admin ALL / anon・authenticated 付与なし)。
- raw 本文は保存しない (summary + source_ref + hash + snippet のみ。L2_DATA 原則)。

---

## 5. 設計判断: D-5拡張か新系統か → **新系統を推奨**

| 観点 | D-5 OS台帳差分 | Coverage Scanner |
|---|---|---|
| 比較対象 | raw × **既知スキーマの特定フィールド** (members/emails/partners/period/billing) | raw × **OS全体のL2カバレッジ + 未知カテゴリ** |
| `diff_kind` | 閉じた enum (member/partner/scope/period/status/billing) | 「丸ごと受け皿が無い」は enum に入らない |
| target | `target_table`/`target_key` が**存在する前提** | target が**未知/不在**であることが検知対象そのもの |

→ D-5 の `diff_kind` enum と「target が既知」前提に、不在検知は構造的に乗らない。**Coverage Scanner は新系統** とし、D-5 を「既知スキーマのフィールド差分」を担う**特化した子**として位置づける。Coverage Scanner が上位の安全網、D-5 はその中の確立済みカテゴリ。

> ナンバリング上は cadence 体系 (L2_DATA.md) の登録管理のため便宜的に **D-15** タグを当ててよいが、概念的には「個別抽出器の上位レイヤー」であり、ただのL2ではない点を明記する。

---

## 6. 実行系 → **daily consolidated routine の最終 Phase に同居**

`amd-os-l2-consolidated-evidence` (daily 08:00 JST) の **最終 Phase M** に追加する。

理由:
- Coverage check (B) は「**その日、他の抽出器が何を拾ったか**」を知る必要がある → 全 D-Phase の**後**に走らせるのが正しい (= 当日のL2書き込み後の negative space を計算)。
- 5生データへのアクセス・connector・差分検知基盤を既存 routine が持っている。
- 別 routine にすると daily run cap を1枠消費し、同日のL2書き込みを見られない。
- LLM 従量を PWA cron で背景実行しない (L2_DATA 原則) に合致 (= サブスク定額枠の Claude routine 内)。

Phase M の手順:
1. (A) ungated salience sweep (当日差分のみ)。
2. claimed source refs index を構築 (全L2横断)。
3. (B) coverage check → gap 抽出。
4. (C) LLM routing suggestion → `gap_class` / `proposed_target_l2` 付与。
5. `POST /api/coverage-gaps/extract` で `l2_coverage_gaps`(candidate) + `l2_notifications(l2_kind='coverage_gap')`。
6. run summary に coverage metric (§8) を1行追加。

---

## 7. 通知・採否ループ

`/notifications` に `l2_kind='coverage_gap'` 種別を追加。**期日付き (due_at) は importance 高で先頭**。

| まさの操作 | 動作 |
|---|---|
| 「これは要対応」 | `action_items` candidate へルート、`routed_to` 記録、gap=confirmed |
| 「これは株主総会/ラウンド」 | governance テーブル候補へルート |
| 「これは経営シグナル」 | `project_strategy_signals` candidate へルート |
| 「これは新カテゴリ」 | gap=confirmed + `gap_class='structural_gap'` で設計TODO 一覧へ (= 受け皿づくりのバックログ) |
| 「無視」 | `rejected` + `l2_feedbacks` へ学習 (= 類似 salience を次回抑制) |

extractor_miss (既存L2にマップできた gap) は、ルートと同時に「該当抽出器が漏らした」記録を残し、抽出器プロンプト改善の入力にする (= ループで取りこぼしを減らす)。

---

## 8. 取りこぼし0 に近づける再現性指標

「脱・属人化」が達成できているかを測る。run summary + `/admin` ダッシュボードに出す。

| 指標 | 定義 | 目標 |
|---|---|---|
| **Coverage rate** | covered_salient / total_salient (source別・日別) | 上昇トレンド |
| **Scanner precision** | confirmed gaps / (confirmed + rejected) | noise を抑えつつ高く |
| **Extractor-miss rate** | confirmed gaps のうち既存L2にマップできた割合 | 下降 (= 抽出器が育つ) |
| **Net-new category count** | `structural_gap` の件数 | 受け皿づくりのバックログ可視化 |
| **Manual-catch escapes** ⭐ | まさが手動でOS化した案件のうち、Scanner が事前に flag できていなかった数 | **→ 0 (これが真の取りこぼし指標)** |
| **Time-to-surface** | raw 到着 → gap surface までの時間。期日系は due前に出たか | 期日前 surface 100% |

### regression corpus (backtest)

- **JOYCLE 招集通知を fixture #1** にする。routine 変更のたびに「Scanner はこれを flag できるか」を回帰テスト。
- 運用後: まさが手動でOS化するたびにその案件をログし、「Scanner が事前に持っていたか」を判定 → **Manual-catch escapes** を継続計測。この値を 0 に近づけることが、本仕組みの成功条件。

---

## 9. 壊さないライン

- 既存 D-1〜D-14 抽出器・D-5・採否ループ・`/notifications` admin gate を変更しない (Coverage Scanner は上位に足すだけ)。
- raw 全文を `l2_coverage_gaps` / 通知に保存しない。
- cap table / 機密 gap を anon 読み取りに晒さない (RLS)。
- `source_cache` を汚さない (gap は専用テーブル)。

---

## 10. 実装フェーズ (承認後)

1. **DDL**: `l2_coverage_gaps` migration (事前承認ゲート) → `dump_schema.py`。
2. **salience allowlist の DB 化** (検知語・ベンダー送信元・noise送信元)。
3. **claimed source refs index ヘルパ** + 各L2の source_ref 保存状況監査 (盲点埋め)。
4. **`POST /api/coverage-gaps/extract`** + `l2_notifications` 種別追加 + `/notifications` UI。
5. **Phase M** を `amd-os-l2-consolidated-evidence/SKILL.md` に追加。
6. **採否ループのルーティング** (gap → action_items/governance/strategy_signal/設計TODO)。
7. **metrics ダッシュボード** + JOYCLE backtest fixture。
8. FEATURE_REGISTRY / L2_DATA.md / manual / spec / db_schema / changelog 同期。
</content>
</invoke>
