# 経営ハイライト 再設計 (#26 #27 #29 #31)

> **状態**: まさ #26 + #27 + #29 + #31 (2026-05-24 夜) 整理。
> **#27 名称確定**: 「経営ハイライト」。**残: 抽出ルール / アイコン軸 / AMD Score 影響併記 / chip 表示**
> を実装着手前にまさと最終確認 → 確定 → 実装。
>
> 関連: [`project_strategy_signals.md`](project_strategy_signals.md) (= 現状の正本仕様、本設計確定後に統合書き換え)

---

## 大原則 (= まさ #26 真意)

> **経営ハイライトは「進んだこと・起きたこと」だけを書く場所。**
>
> 「未了」「TODO」「アイディア」「議論中」は経営ハイライトに **入れてはいけない**。

→ `decision_state` 軸は **`done` のみ** が経営ハイライトに表示される。  
未了の判断や検討中の議題は **MTG サマリ** (= 議事録) や **議題リスト** (= 別軸) で扱う。

→ ダイキアクシス「経営判断未了」signal は経営ハイライトに出るべきではなかった。  
本当の違和感は「経営全般カテゴリに入ってる」ことではなく「**未了なのに進捗を書く場に書いてる**」ことだった。

---

## 名称 (= #27 確定)

セクション名: **経営ハイライト**

(旧名「経営・事業シグナル」を全廃)

---

## 定義

> **経営ハイライト** = PJ にとって **進んだこと・起きたことの事象ログ**。
>
> 入れる:
> - **進捗があった** (= 大きな前進、契約締結、特許出願完了、量産開始、提携合意、ブレークスルー等)
> - **方針が変わった** (= 戦略転換が決まった、撤回が決まった、新ピボットが決まった)
> - **外部環境が変化した** (= 規制強化、競合の動き、市場ショック等で PJ 進路に影響あったもの)
> - **リスクが顕在化した** (= 損害発生、課題顕在化等の **起きた事象**)
>
> 入れない:
> - 未了の判断 (= 議論中・検討中の話)
> - TODO・次の一手・アイディア
> - 進捗率だけで表せる MS 作業 (= MS リストへ)
> - 単なる日程調整
> - 既存ハイライトの言い換え

**狙い**: 将来の株主説明会・事業報告書 (= 半期 / 年次レポート) を、ここに並んだハイライトをまとめるだけで自動生成できる状態にする。

---

## ぱっと見アイコン (= まさ #29 + #26 アイコン要望)

カード左端にアイコンで「これは何の事象か」を一発で示す。

| アイコン | 意味 | 該当例 |
|---|---|---|
| **🎉** | 大進捗・ブレークスルー | 特許出願完了、量産開始、大型受注、IPO 内諾 |
| **✨** | 順調な前進 | LOI 締結、PoC 完了、技術検証成功、調達合意 |
| **🔄** | 方針転換・戦略変更 | 事業ピボット、戦略撤回、優先順位変更 |
| **⚠️** | リスク顕在化・悪化 | 訴訟、品質問題、契約破棄、競合の脅威台頭 |
| **🌐** | 外部環境変化 (中立) | 規制強化、マクロ動向、政策変化 |

→ 「ポジティブ・ネガティブ・中立」の polarity が一目でわかる。  
→ 細かい signal_type は **2 軸目** として小さく出す (= 「資金」「提携」「特許」等)。

---

## 軸の整理

### 軸 1: `polarity` (新規) — ぱっと見アイコン

| 値 | アイコン | 意味 |
|---|---|---|
| `breakthrough` | 🎉 | 大進捗 |
| `forward` | ✨ | 順調な前進 |
| `pivot` | 🔄 | 方針転換 |
| `risk` | ⚠️ | リスク・悪化 |
| `external` | 🌐 | 外部環境 |

### 軸 2: `signal_type` (現状から見直し) — 細分類

| 新 signal_type | 旧との対応 | 説明 | 想定 polarity |
|---|---|---|---|
| `partnership` | partnership | 提携 (LOI / 出資 / 共同開発合意) | ✨ or 🎉 |
| `commercial` | commercial_progress + business_progress (= 売上系) | 商談・受注・契約締結 | ✨ or 🎉 |
| `business_milestone` | business_progress (= 設立系) | 設立・参画・量産・事業承認 | 🎉 |
| `funding` | funding | 資金調達 (= 完了 or 入金) | ✨ or 🎉 |
| `tech_progress` | tech_progress | 自社特許出願完了 / 技術ブレークスルー | ✨ or 🎉 |
| `strategy_change` | strategic_pivot + management_decision (= 確定方針のみ) | 戦略変更・方針撤回・新ピボットの確定 | 🔄 |
| `external_regulation` | ip_regulatory | 他国規制変化 | 🌐 |
| `external_market` | (新規 or risk から) | マクロ市場変化 / 競合動向 | 🌐 |
| `risk_realized` | risk | 純粋な外部リスクの顕在化 (= 起きた、損害発生済み) | ⚠️ |

廃止:
- `management_decision` → `strategy_change` に統合 (= 確定方針のみ採用)
- `next_move` → **完全廃止** (= 「次の一手」= TODO は経営ハイライト対象外)
- `risk` → `risk_realized` に改名 (= 顕在化したもののみ)

### 軸 3: `impact_level` — 影響度

`low` / `medium` / `high` / `critical` — 現状維持。

### 軸 4: `decision_state` — **撤廃**

経営ハイライトは done のみ書く運用なので、軸として持つ意味がない。

(未了の判断は MTG サマリの risks/decided 配列で扱う = 既存)

### 軸 5: `status` — UI 表示のみ簡素化

`candidate` / `confirmed` / `rejected` / `archived` (DB は維持)。  
UI では candidate のみ「⚠️ 未確認」注釈、confirmed は chip 出さない。

---

## AMD Score 影響併記 (= #31)

> **経営ハイライトは AMD Score S に与える影響が少なからずあるはず。**
> **そのハイライトによってどのような影響が出たかをあわせて書く。**

### 案 A: signal レコードに impact_summary 列を追加

```sql
ALTER TABLE project_strategy_signals
  ADD COLUMN score_impact_summary TEXT,           -- 「TRL 4→5、X 206→240」のような短文
  ADD COLUMN score_impact_delta_json JSONB;       -- { "TRL": { "before": 4, "after": 5 }, "S": { "before": 3500, "after": 3900 } }
```

- LLM 抽出時に「この signal の AMD Score 影響を予測」→ summary 生成 + delta JSON
- 既存の `amd_score_inputs` の前後比較で actual delta も後追い計算可

### 案 B: 既存 summary 内に書く運用 (列追加なし)

```
summary: "5/13 NDA 完了。来週月曜にダイキアクシス開発部長と打ち合わせ予定。
影響: 提携が一歩前進、X 軸 BRL の +0.5 寄与見込み (実測待ち)"
```

= シンプル、運用負担小。  
= ただし機械的に取り出しにくい (= 後追い集計時に困る)。

### 案 C: 別テーブル `strategy_signal_score_impacts`

```sql
CREATE TABLE strategy_signal_score_impacts (
  signal_id UUID REFERENCES project_strategy_signals(signal_id),
  axis TEXT,            -- "TRL" / "BRL" / "M" / "X" / "F" / "S"
  before_value NUMERIC,
  after_value NUMERIC,
  measured_at TIMESTAMPTZ,
  source TEXT           -- "predicted" / "measured"
);
```

= 履歴と原因追跡が一番きれい。  
= ただしテーブル設計と LLM 抽出が重い。

**推し**: **案 A** (= 列追加で start、UI で「📊 影響: ...」line を 1 行追加)

UI イメージ:
```
[5/13] 🎉 [tech_progress 自社特許/技術] [high]
リアクター特許出願完了 (4/27付)
4/27 にリアクター特許の出願が完了したことが 5/13 定例MTGで共有・確認された。...
📊 影響: TRL 4→5、技術スタック前進。AMD Score X 軸寄与 +約 40 ポイント。
▶ 根拠 1 件
```

---

## カード表示 (= #29 確定案)

**案 F-2 (改訂): polarity アイコン + 4 分類カラー型 + impact chip + 影響 1 行**

```
[5/13] 🎉 [🔬 自社特許/技術] [high]                    [⚠️ 未確認 (= candidate のみ)]
リアクター特許出願完了 (4/27付)
4/27 にリアクター特許の出願が完了したことが 5/13 定例MTGで共有・確認された。...
📊 影響: TRL 4→5、技術スタック前進。AMD Score X 軸寄与 +約 40 ポイント。
▶ 根拠 1 件          [⚠️ つくよみに修正依頼]
```

chip 構成:
1. **日付** (M/D)
2. **polarity アイコン** (🎉/✨/🔄/⚠️/🌐) — 主視覚
3. **signal_type chip** (= 4 分類カラー + 細分類名) — 副情報、左ボーダー色とセット
4. **impact chip** (low/medium/high/critical)
5. **「⚠️ 未確認」** (candidate のみ、右端注釈)

撤廃:
- decision_state chip (= 「決定」)
- 旧 status chip (= 「候補」)

---

## ダイキアクシスシグナル (= #26) の最終判定

```
ダイキアクシス (DAVP) との関係深化・出資・共同開発の距離感を経営判断未了
(PSI Step2 事業化推進機関として既に参画)
```

→ **経営ハイライトに含めない (= status='rejected' or 別場所に移管)**

理由:
- 「経営判断未了」= done でない = 経営ハイライト対象外
- これは **「次回まさえいMTGで議論すべき議題」** として MTG サマリ or 議題リストに記録すべき

代わりに、もし以下のような **done** な事象が発生したら経営ハイライトに入れる:
```
[5/21] ✨ [🚀 提携] [critical]
ダイキアクシス (DAVP) と PSI Step2 事業化推進機関として正式参画決定
5/21 SX 内部MTG で、ダイキアクシス (DAVP) を事業化推進機関として
正式参画させることが決定された。出資・共同開発の具体的距離感は次フェーズで
協議予定だが、参画自体は確定。
📊 影響: 事業前進、X 軸 BRL +0.5 想定。
```

---

## 抽出ロジック (= LLM prompt 更新方針)

Codex automation `amd-os-strategy-signals` の prompt に以下を追加:

```
経営ハイライト 抽出ルール (まさ #26 #27 #29 #31 2026-05-24):

1. 「進んだこと・起きたこと」のみ抽出する:
   - decision_state='done' に相当するもの (= 確定済、実行済、起きた)
   - 「未了」「議論中」「検討中」「TODO」「アイディア」は除外
   - 「経営判断未了」「方針未決」のような表現が含まれるものは除外し、
     代わりに「議題リスト」(= MTG サマリの decided/risks 配列) に回す

2. signal_type 判定 (= polarity 自動推定の元):
   - 特定 partner との関係性 (LOI / NDA / 出資 / 共同開発合意) → partnership (= ✨ or 🎉)
   - 商談・受注・契約締結 → commercial (= ✨ or 🎉)
   - 設立・正式参画・量産化 → business_milestone (= 🎉)
   - 資金調達確定 / 入金 → funding (= ✨ or 🎉)
   - 自社特許出願 / 技術ブレークスルー → tech_progress (= ✨ or 🎉)
   - 戦略変更・方針撤回の確定 → strategy_change (= 🔄)
   - 他国規制動向 / 政策変化 → external_regulation (= 🌐)
   - マクロ市場変化 / 競合動向 → external_market (= 🌐)
   - 顕在化したリスク (損害発生済み) → risk_realized (= ⚠️)

3. polarity アイコン判定:
   - 大進捗 (= IPO 内諾、量産開始、大型受注、特許出願完了) → breakthrough (🎉)
   - 順調な前進 (= LOI、PoC 完了、調達合意) → forward (✨)
   - 戦略転換 → pivot (🔄)
   - リスク・悪化 → risk (⚠️)
   - 外部環境 (中立観測) → external (🌐)

4. AMD Score 影響予測:
   - 各 signal に対し「7 軸のどれが、いくつ動くか」を予測して
     `score_impact_summary` に 1 行 (例: "TRL 4→5、X 軸 +40pt")
   - `score_impact_delta_json` に JSON で構造化
   - 予測値なので「想定」「見込み」と書いて、実測値は別タイミングで update

5. 既存除外ルール (継続):
   - 「partner との議論」を「strategy_change」や「management_decision」に入れない (= 必ず partnership)
   - 「リスク」という言葉だけで「risk_realized」にしない (= 純粋な外部要因かつ顕在化済みか?)
   - 自社特許出願 / 知財戦略 / 技術スタック進捗 は tech_progress、
     他国規制動向 / 競合知財動向 は external_regulation (= 内部活動 vs 外部要因で分ける)
```

---

## 実装ステップ (= 確定後)

### Step 1: DDL (migration 089)
- `project_strategy_signals` に `polarity` TEXT、`score_impact_summary` TEXT、`score_impact_delta_json` JSONB 追加
- `signal_type` の CHECK 制約を新値に拡張 (= `business_milestone`, `commercial`, `strategy_change`, `external_market`, `risk_realized` を追加、旧 `management_decision` / `next_move` / `business_progress` / `commercial_progress` / `ip_regulatory` / `risk` は廃止候補)
- 旧 type を全件 re-label (= manual + 後追い LLM)

### Step 2: UI 改修 (CockpitStrategySignals.tsx)
- セクション名「経営・事業シグナル」→「経営ハイライト」
- TYPE_LABEL / CATEGORY_OF_TYPE を新 type に更新
- POLARITY_ICON 定数追加 (= 5 種類)
- STATE_LABEL 撤廃
- candidate chip → 注釈に変更
- score_impact_summary を summary の下に 1 行で表示
- 「⚠️ つくよみに修正依頼」は維持

### Step 3: LLM prompt 更新
- Codex automation `amd-os-strategy-signals` の prompt にルール反映
- まさのローカル `.codex/` 配下を触る or scheduled task で更新

### Step 4: 既存 candidate / confirmed の整理
- 「未了」「TODO」「アイディア」系の signal を rejected or archive
- 残った signal に polarity / score_impact_summary を後追い付与 (= まさえいMTG で 1 件ずつ)

### Step 5: ドキュメント更新
- `project_strategy_signals.md` → 全面書き換え (= 本書の内容を統合、名称も「経営ハイライト」へ)
- `cockpit.md` 内の経営シグナル記述を更新
- `FEATURE_REGISTRY.md` の anchor を更新
- `check_pwa_critical_ui.cjs` の anchor を更新

---

## 残設計事項 (= 次セッションでまさ確定)

1. **🚨 確認**: 「経営ハイライト」だけで本当に十分か? 「未了議題リスト」は別 UI で出さなくていいのか? (= MTG サマリ内の risks/decided 配列で見れるが、cockpit 上に専用枠を作るかどうか)
2. **🚨 確認**: アイコン 5 種類 (🎉/✨/🔄/⚠️/🌐) で過不足ないか?
3. **🚨 確認**: AMD Score 影響は **案 A (= 列追加)** で OK か? 別案あるか?
4. **DDL apply タイミング**: Step 1 を migration 089 で実施するか、まずは UI だけ変えて DDL は別 commit にするか
5. **既存 candidate の処理ポリシー**: 「未了」を全部 rejected にするか、「議題リスト」に移管するか
