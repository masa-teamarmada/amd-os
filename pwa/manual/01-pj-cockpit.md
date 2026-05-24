# 01. PJ コックピット

AMD OS の **中心画面**。各 PJ ごとに 1 つあり、URL は `/project/{project_id}/cockpit` (例: `/project/p21/cockpit` = SX)。

## 誰がいつ使うか
- **PM** (= まさ / かる / ちこ等) が日常的に開く
- **月次ルーティン**で月初・月末に各 step を触る
- 経営判断のタイミングで **経営ハイライト** を確認・採否
- **まさえいMTG** で議題を出すときに、各 PJ の candidate をここで見る

## 画面構成 (上から)

```
┌─────────────────────────────────────────────────────┐
│  PJ ヘッダー (= 名前 / レーン / アウトカム / 設立日)   │
├─────────────────────────────────────────────────────┤
│  AMD スコアグラフ │ M/X/F カード │ XRL 進捗グラフ      │
├──────────────────┬──────────────────┬──────────────┤
│  年間 MS リスト   │  経営ハイライト   │  月次ルーティン │
│  月次サマリ       │  MTG サマリ        │  つくよみメモ   │
└──────────────────┴──────────────────┴──────────────┘
```

(= 3 カラム x 2 段、まさ #28 確定 2026-05-24)

---

## 1.1 PJ Status (= AMD Score / XRL)

### AMD Score
- 7 軸 (Triple Helix μ_A/μ_I/μ_G + TRL/BRL/GRL/SRL/HRL + grit/resilience) を Cobb-Douglas で合成した総合スコア
- **過去 = 実線** (黒)、**未来予測 = 破線** (5 4 dash) で表示
- 右上 pill (大数字) は **現在のスコア** (= 過去最終点)
- M/X/F カード = 現在の `M` (MACROTREND, max 30) / `X` (XRL, max 600) / `F` (FRL, max 100) 内訳

### XRL 進捗 (5 軸)
- TRL (技術) / BRL (事業化) / GRL (制度) / SRL (社会) / HRL (人材)
- 1-9 段階で内閣府 SIP 体系互換
- Gemini 2.5 Flash が毎朝 03:15 JST に判定 → `/notifications` で「はい / いいえ」承認 → 確定
- ドットクリック (= 透明 r=16 hit area) で詳細モーダル

→ **判定ロジック詳細は [03 章 3.3 抽出パイプライン](03-data-and-extraction.md#33-抽出パイプライン)** + **[05 章 5.4 責務分担マトリクス](05-decisions-and-history.md#54-codex--claude--vercel--launchagent-責務分担マトリクス)** 参照。

---

## 1.2 年間マイルストーン (MS)

- 4 月期-3 月期で 年間 10-15 個の MS を持つ
- 各 MS は `pt` (= ポイント)、`effort` (= 年間 / 期 / 単発)、責任者 (= まさ / かる / 等の share %)
- Gantt 表示 (= 月 4/26-3/27)
- 各 MS をクリック → 詳細モーダル

### MS の進捗
- `milestone_monthly_progress.note` + `progress_pct` で月次更新
- Codex automation `amd-os-ms` が 6h ごとに 5 生データから差分推定
- 月次ルーティン step「2. 報告会日程調整」あたりで PM が確認・確定

### MS の 3 列展開 (= まさ #17 仕様、未実装)
- **🎯 ゴール** = `value_milestones.success_criteria`
- **📝 やること** = `milestone_sub_items` + `responsibility.task_description`
- **📍 現状** = `milestone_monthly_progress.note` + `progress_pct`

→ 実装は別タスク。

---

## 1.3 経営ハイライト (= 旧「経営・事業シグナル」)

> **これは「進んだこと・起きたこと」だけを書く場所**。未了 / TODO / アイディア / 議論中は **書かない** (= 別の場所、たとえば TODO かんばん #26 設計予定)。
> (まさ #26 #27 2026-05-24 確定)

### 4 分類

| 分類 | 色 | 含まれる signal_type |
|---|---|---|
| 🏛 **経営全般** | violet | `management_decision` / `strategic_pivot` / `funding` / `next_move` |
| 🚀 **事業開発** | emerald | `business_progress` / `commercial_progress` / `partnership` |
| 🔬 **技術開発** | sky | `tech_progress` (= 自社特許 / 技術スタック進捗) |
| 🌐 **外部環境** | amber | `ip_regulatory` (= 他国規制等) / `risk` |

外部マクロ一覧の正本は **Atlas** (= header の「Atlas で全マクロ ↗」リンク)。ただし PJ にとって重要な外部シグナルも cockpit に並ぶ (= 例: 5/21 中国レアアース → SX 重金属回収追い風)。

### Polarity アイコン (= まさ #29 #26 4 種類確定 2026-05-24)
- 🎉 大進捗 (= IPO 内諾、量産開始、特許出願完了、大型受注)
- ✨ 順調な前進 (= LOI 締結、PoC 完了、調達合意)
- 🔄 戦略転換 (= 事業ピボット、戦略撤回)
- ⚠️ リスク・悪化 (= 訴訟、品質問題、契約破棄)

→ **🌐 中立アイコンは廃止** (まさ判断 #29 2026-05-24): 外部環境シグナルも中立じゃなく、PJ にとってプラスかマイナスのいずれか。中立なら書く必要がない。

### AMD Score 影響併記 (= まさ #31 2026-05-24)
各シグナルに「📊 影響: TRL 4→5、X 軸 +40pt」を 1 行で添える (= `score_impact_summary` 列、実装は別 task)。

### candidate と confirm の違い
- **candidate** = Codex automation が抽出したばかり、まさが内容を確認する前 (= 「⚠️ 未確認」注釈)
- **confirmed** = まさえいMTG でまさが「これで OK」と確定したもの (= 注釈なし)
- **rejected** = 抽出が誤りでまさが却下したもの (= 表示しない)

詳しいフローは **[02 章 2.2 まさえいMTG](02-amd-cockpit.md#22-まさえいmtg)**。

### つくよみに修正依頼
各シグナルに「⚠️ つくよみに修正依頼」ボタンあり。修正コメント (= 例「これは LOI じゃなく NDA」) を投げると `l2_feedbacks` に保存され、**次回 Codex automation の抽出 prompt に過去フィードバックとして含められる** (= 学習ループ)。

→ 詳細は **[03 章 3.4 つくよみ修正依頼 → 学習ループ](03-data-and-extraction.md#34-つくよみ修正依頼--学習ループ)**。

---

## 1.4 MTG サマリ

- `project_meeting_summaries` テーブル
- 入力: Calendar (= 開催情報) + Slack / Notion / Drive (= 議事録本文) + dialogue API (= まさえいMTG)
- `source_kinds` で種別判別: `regular` (= 定例) / `dialogue` (= まさえいMTG) / `upcoming` (= 未開催、議題ストック、#18 未実装)
- 詳細モーダルで `narrative_md` (= Sonnet 4.6 が「背景 → 議論の流れ → 2 人で出した提案 → 残課題」の Markdown narrative に書き直したもの) を主表示
- raw 配列 (= 元データ) は折りたたみ「元データ」へ

### 「まさえいMTG」とは
- まさとえいみ (= LLM) で経営判断議論セッション
- かる/ちこ等への疎外感回避で「経営会議」呼びは廃止 (= まさ #7 2026-05-24 確定)
- 詳細は **[02 章 2.2 まさえいMTG](02-amd-cockpit.md#22-まさえいmtg)**。

---

## 1.5 月次ルーティン (= 報告書 / 請求 / 会計)

各月の運用 step (= 例: 2026-04 稼働分):
1. **請求額確定** (= 期限超過 = 赤表示)
2. **報告会日程調整**
3. **月次報告書 FIX**
4. **請求書発行**
5. **請求書送付**

各 step をクリックで詳細モーダル。step 完了で次へ。

→ 詳細は **[04 章 admin オペ](04-admin-ops.md)** へ。

---

## 1.6 つくよみメモ

`tsukuyomi_nudge_queue` テーブルに溜まる「LLM が見つけた要注意事項」を右下に表示。例:
- 「DG ダイワ から VC 6/12 同時突入予定の進行確認」
- 「ちこの活動量が直近 7 日で減少」

各 nudge は「対応済」or「無視」で消える。

---

## 1.7 メンバー / 事業会社 / 創業メンバー (= 用語の使い分け ⭐)

**ここで使われる「メンバー」関連用語は紛らわしい**。整理:

| ボタン / モーダル名 | 実態 | データソース |
|---|---|---|
| **👥 メンバー** | AMD 内部メンバー (= まさ / かる / ちこ 等) で、この PJ に伴走してる人 | `project_members.member_id` (= AMD members table への FK) |
| **🤝 事業会社** | 興味事業会社 (= 協業先 / 顧客候補)。法人レベル | `project_partners` |
| **「創業メンバー」モーダル内の表示** | ⚠️ **実態は「関連メンバー」全部** = SU 創業候補 + 事業会社担当 + VC 担当 + その他関係者まで含む | `project_founding_members` (= LLM 抽出、紛らわしい名前) |

→ **`project_founding_members` という名前は誤解を生む** (= 創業メンバーだけじゃない、関連メンバー全体)。リネーム候補。マニュアルでは「**関連メンバー (= LLM 抽出)**」と呼ぶ。

→ 詳細は **[03 章 3.5 用語と実装の対応](03-data-and-extraction.md#35-用語と実装の対応)** へ。

---

## 関連
- 設計議論: [`pwa/design/cockpit.md`](../design/cockpit.md), [`pwa/design/project_strategy_signals.md`](../design/project_strategy_signals.md), [`pwa/design/strategy_signals_redesign.md`](../design/strategy_signals_redesign.md)
- 過去判断ログ: **[05 章 過去判断と経緯](05-decisions-and-history.md)**
