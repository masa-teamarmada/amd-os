# 経営・事業シグナルの定義・名称・タグ再設計 (#26 #27 #29)

> **状態**: まさ #26 / #27 / #29 (2026-05-24 夜) で提起された 3 件をまとめた設計議論
> 叩き台。**次セッションで議論再開 → 確定 → 実装**。
>
> 関連: [`project_strategy_signals.md`](project_strategy_signals.md) (= 現状の正本仕様)

---

## 背景 (まさ提起の整理)

### #26 ダイキアクシスシグナルが「経営全般」に入ってる違和感

`5/21 方針決定 ダイキアクシス (DAVP) との関係深化・出資・共同開発の距離感を経営判断未了
(PSI Step2 事業化推進機関として既に参画)`

- 現状: `signal_type='management_decision'` → 4 分類で **🏛 経営全般 (violet)**
- まさ違和感: これは事業 partner (= ダイキアクシス) との関係性議論なので **🚀 事業開発 (emerald)**
  に入るべき (= `partnership` or `commercial_progress`)
- 抽出ロジックが「経営判断未了」という文言を拾って `management_decision` と判定したと思われる

### #27 セクション名「経営・事業シグナル」がわかりにくい

まさが求める実態:

- **大きな進捗 / 方針転換 / 外部環境変化** を書く
- 経営状況がどう変化したかを追える
- 株主向け説明会 / 事業報告書のベースになる「事象ログ」

→ 名称候補 + 定義の明確化が必要 (= 「ここに書くべきもの」が曖昧だと #26 の抽出も
ズレ続ける)。

### #29 カード上のタグが意味不明

現状 1 カードに同時表示:

```
5/21 [🏛] [方針決定] [high] [候補] [決定]  ← どういう意味??
```

- 「方針決定」(= `signal_type='management_decision'`)
- 「決定」(= `decision_state='decided'`)
- 「候補」(= `status='candidate'`)

→ 「方針決定」と「決定」が **言葉として紛らわしい**、「候補なのに決定?」が **矛盾に見える**。

---

## 現状の軸 (= 設計レベルでの整理)

| 軸 | DB 列 | 取りうる値 | 意味 |
|---|---|---|---|
| シグナルの種類 | `signal_type` | 10 種類 (management_decision / business_progress / strategic_pivot / commercial_progress / partnership / funding / ip_regulatory / tech_progress / risk / next_move) | **何が起きたか** |
| 4 分類カテゴリ | (signal_type から派生) | management / business / tech / external | UI 上の **色分けグルーピング** |
| 影響度 | `impact_level` | low / medium / high / critical | **どれくらい重要か** |
| 議論・意思決定の状態 | `decision_state` | observed / proposed / decided / executing / revised | **意思決定がどこまで進んだか** |
| OS 登録ステータス | `status` | candidate / confirmed / rejected / archived | **まさが OS で confirm したか** |

---

## 問題の分解

### 問題 A: signal_type の定義が「事象の種類」と「意思決定の状態」を混在させている

例:
- `management_decision` = 「経営判断」というアクション系
- `business_progress` = 「事業進捗」という事象系
- `next_move` = 「次にやる」という時間軸系
- `risk` = 「悪い方向に動く」というネガティブ系

→ 軸がブレてる。だから「ダイキアクシスとの距離感未了」みたいに `partnership` 系の事象 + `decision_state='observed'`
(= まだ決まってない) という意味のものを、LLM が `management_decision` に押し込んでしまう。

### 問題 B: decision_state と signal_type が UI 上で同じ chip 列に並ぶ

- `signal_type='management_decision'` → 表示「方針決定」
- `decision_state='decided'` → 表示「決定」
- 並ぶと「決定が決定された?」みたいに見える

### 問題 C: status (candidate) の意味がユーザーに伝わらない

- candidate = つくよみが自動抽出したが、まだまさが confirm してない状態
- ユーザー側 (= まさ自身) には「これは仮なのか、本物なのか」だけ分かればいい

### 問題 D: 4 分類カテゴリと signal_type が二重表示で冗長

- 左ボーダー色 (= 4 分類)
- 絵文字 chip (= 4 分類)
- type 名 chip (= signal_type)

→ 「事業開発 (= emerald) の partnership」のように、カテゴリと type が **意味的に重複**
することがある (= type が見えてればカテゴリの絵文字は要らない)。

---

## 改善案

### A. セクション名候補 (= #27)

| 候補 | ニュアンス | 株主説明会向け? |
|---|---|---|
| **経営トピックス** | 「トピックス = 話題・出来事」、経営的に重要な動き | ◯ |
| **事業ハイライト** | 「ハイライト = 目立つ動き」、ポジティブ寄り | ◯ |
| **重要トピックス** | 中立的、最も汎用 | ◯ |
| **大事な動き** | カジュアル、社内向け | △ |
| **節目** | 「節目 = milestone と被る」 → 避けたい | × |
| **主要シグナル** | 「シグナル」を残す、現状名の縮約 | △ |
| **経営の節目・転機** | 説明的、長い | △ |
| **重要ニュース** | 外部発の出来事に聞こえる | × |
| **重要事象** | 中立、客観的 | ◯ |
| **動向ログ** | フォーマル、報告書向け | ◯ |
| **アジェンダ** | 「議題」ニュアンス、議論前提 | △ |

**推し案**: 「**経営トピックス**」もしくは「**重要トピックス**」
- 「トピックス」が「大きな進捗 / 方針転換 / 外部環境変化」を包含する汎用語
- 株主説明会 / 事業報告書のベースに使うときに自然 (= 「今期の経営トピックス」と書ける)

### B. 定義の明確化 (= #27)

> **経営トピックス** (案) = PJ 経営状況の変化を時系列で残す **事象ログ**。
>
> 入れる:
> - **大きな進捗** (= MS 進捗より上位の事業前進。商談、提携、資金、特許出願、技術ブレークスルー)
> - **方針転換** (= 経営方針の決定・変更・撤回)
> - **外部環境変化** (= 規制、競合、マクロ要因の変化で PJ 進路に影響するもの)
> - **重要リスクの顕在化** (= 純粋な外部リスクのみ、内部の判断未了は方針転換側)
>
> 入れない:
> - 単なる日程調整 / TODO
> - 進捗率だけで表せる MS 作業 (= MS リストへ)
> - 既存トピックスの言い換え
> - source refs が弱い推測
>
> **狙い**: 将来の株主説明会・事業報告書 (= 半期レポート / 年次レポート) を、ここに
> 並んだトピックスをまとめるだけで自動生成できる状態にする。

### C. signal_type の見直し (= #26 #29 共通)

**案 C-1: signal_type の軸を「事象の種類」に統一**

「意思決定の状態」(= decided / observed / proposed) は **decision_state に分離**:

| 新 signal_type | 旧との対応 | 意味 | 4 分類 |
|---|---|---|---|
| `strategy_pivot` | `strategic_pivot` + `management_decision` (= 方針系) | 戦略転換・方針決定 | 🏛 経営 |
| `funding` | `funding` | 資金調達 | 🏛 経営 |
| `next_move` | `next_move` | 次の一手 (=計画) | 🏛 経営 (廃止検討) |
| `partnership` | `partnership` | 提携先との関係性変化 | 🚀 事業 |
| `commercial_progress` | `commercial_progress` + `business_progress` (= 売上系) | 商談・売上・LOI/NDA | 🚀 事業 |
| `business_milestone` | `business_progress` (= 事業化系) | 設立・正式参画・量産化 | 🚀 事業 |
| `tech_progress` | `tech_progress` | 自社特許出願 / 技術スタック前進 | 🔬 技術 |
| `external_regulation` | `ip_regulatory` (= 外部) | 他国規制動向 / 競合の知財動向 | 🌐 外部 |
| `external_market` | (新規) | マクロ市場ショック / 競合ニュース | 🌐 外部 |
| `risk_realized` | `risk` | 純粋な外部リスクの顕在化 | 🌐 外部 |

ポイント:
- `management_decision` を廃止 (= `strategy_pivot` に統合)
- `business_progress` (= 曖昧で雑多に入る箱) を `commercial_progress` / `business_milestone` に分割
- `ip_regulatory` の名前を `external_regulation` に変えて「外部要因」と明確化
- `risk` を `risk_realized` にして「顕在化したリスクのみ」と明確化

**案 C-2: signal_type を撤廃して 4 分類カテゴリだけ**

| カテゴリ | 説明 |
|---|---|
| 🏛 経営 | 方針決定・戦略転換・資金調達 |
| 🚀 事業 | 提携・商談・売上・事業マイルストーン |
| 🔬 技術 | 自社特許・技術進捗 |
| 🌐 外部 | 規制・競合・マクロ要因 |

= シンプル。LLM 抽出も「どのカテゴリ?」で判定するだけ。  
= ただし「これは資金調達」「これは商談」など細かい分類ができなくなる → 後で集計・レポート時に困る可能性

**推し**: 案 C-1 (= 軸を「事象の種類」に統一、name は分かりやすく改名)

### D. decision_state の整理 (= #29)

**現状**: observed / proposed / decided / executing / revised の 5 段階

**案 D-1: 3 段階に圧縮**
- `pending` (= 未決定・議論中。observed + proposed + revised を統合)
- `decided` (= 方針確定・実行中。decided + executing を統合)
- `done` (= 完了・成果が出た、新規)

→ ユーザーが見るのは「これは確定した話か、まだ議論中か」だけで十分

**案 D-2: 撤廃**
- 「方針が決まったか否か」は summary 本文で表現できるので、軸として持たない

**推し**: **案 D-1 の 3 段階化** (= 「これが決まったかどうか」は重要だから残す、ただし軸名を見直す)

### E. status (= candidate / confirmed) の見直し (= #29)

**現状**: candidate / confirmed / rejected / archived

**案 E-1: 内部状態として隠す**
- ユーザー側は candidate も confirmed も区別したい時だけ chip 出す
- 通常は表示せず、candidate のみ「⚠️ 未確認」chip を控えめに

**案 E-2: 軸名を「OS 確認状態」と明示**
- 「OS: 候補 (未確認)」「OS: 確認済」と prefix 付き

**推し**: **案 E-1** (= 確認済の chip は表示しない、candidate だけ「⚠️ 未確認」と控えめに)

### F. UI 上の chip 表示 (= #29)

**案 F-1 (= 推し)**: chip を 3 つに減らす

```
[5/21] [🚀 提携] [high] ← この 3 つだけ

(下に title, summary, ⚠️ 未確認 (= candidate のみ), 根拠リンク)
```

- 日付
- カテゴリ絵文字 + signal_type (= まとめて 1 chip、色は 4 分類カラー)
- impact_level
- candidate なら別行で「⚠️ 未確認」(= chip ではなく注釈)
- decision_state は撤廃 or summary 本文で表現

**案 F-2**: 軸ラベル付き chip

```
[5/21] [タイプ: 🚀 提携] [影響: high] [状態: 議論中] [OS: 候補]
```

- ラベル付きで各軸の意味を明示
- 長い、ノイジー

**推し**: **案 F-1** (= 必要最小限、状態は本文で)

---

## 改善案 まとめ (= 次セッションでまさ確定)

| 項目 | 推し案 | 影響範囲 |
|---|---|---|
| セクション名 | 「経営トピックス」 | CockpitStrategySignals.tsx の `<h2>` + cockpit.md + project_strategy_signals.md + FEATURE_REGISTRY.md |
| 定義 | 上記 B (= 株主説明会ベース) | project_strategy_signals.md の「抽出基準」を書き換え + LLM prompt 更新 |
| signal_type | 案 C-1 (= 軸を「事象の種類」に統一して改名) | DB 内容を re-label (= migration + データ書き換え) + LLM prompt 更新 + CATEGORY_OF_TYPE 更新 + TYPE_LABEL 更新 |
| decision_state | 案 D-1 (= 3 段階に圧縮) | DB 値を re-label + UI で chip 表示やめる (本文で表現) |
| status | 案 E-1 (= candidate のみ「⚠️ 未確認」注釈) | UI 修正のみ |
| chip 表示 | 案 F-1 (= 3 chip に減らす) | UI 修正のみ |

---

## ダイキアクシス例での再分類 (= #26 確認)

現状: `signal_type='management_decision'` (= 方針決定 = 経営全般)

新案 C-1 + 案 D-1 で再分類:
- `signal_type='partnership'` (= 提携、🚀 事業開発)
- `decision_state='pending'` (= 未決定・議論中、本文で「経営判断未了」と表現)
- `impact_level='critical'` (= 維持)

UI 表示 (案 F-1):
```
[5/21] [🚀 提携] [critical] [⚠️ 未確認]
ダイキアクシス (DAVP) との関係深化・出資・共同開発の距離感を経営判断未了
(PSI Step2 事業化推進機関として既に参画)
```

→ まさが見て「事業開発の提携シグナル、まだ決まってない、影響度クリティカル」と一発で分かる。

---

## 抽出ロジック修正 (= #26 根本対応)

LLM 抽出 prompt (= Codex automation `amd-os-strategy-signals`) の判定基準を以下のように厳密化:

```
signal_type 判定:
- 「partnership」: 特定の社外 partner (= 会社名・PI 名) との関係性に関する話 (LOI / NDA /
  共同開発 / 出資 / 距離感)。partner との議論なら、まだ決まってなくても partnership
- 「commercial_progress」: 売上・受注・商談・案件進捗 (= 金額や数字を伴う取引)
- 「business_milestone」: 設立・参画・量産化・事業承認 (= 法人としての節目)
- 「strategy_pivot」: 事業方針そのものの変更・撤回・新規ピボット (= 内部の判断)
- 「funding」: VC / 公的資金 / 助成金の調達
- 「tech_progress」: 自社内の特許出願 / 技術スタック前進
- 「external_regulation」: 他国規制動向 / 競合の知財動向
- 「external_market」: マクロ市場ショック / 競合ニュース
- 「risk_realized」: 純粋な外部リスクの顕在化

NG パターン:
- 「partner との議論」を「strategy_pivot」や「management_decision」に入れない (= 必ず partnership)
- 「経営判断未了」というキーワードを拾って即「management_decision」にしない (= 内容で判断)
- 「リスク」という言葉だけで「risk_realized」にしない (= 純粋な外部要因か?)

decision_state 判定:
- 「pending」: まだ決まってない / 議論中 / 検討中
- 「decided」: 方針確定・実行中
- 「done」: 完了・成果が出た
```

---

## 実例: 現状の SX (p21) cockpit シグナル 6 件を再分類してみる

| # | signal | 現状 type | 案 C-1 type | 案 D-1 state | impact | 4 分類 |
|---|---|---|---|---|---|---|
| 1 | 資金調達戦略を「大規模VC調達+企業開発費で初期生産」へ転換、ファインケム北陸工場でPoC候補地確認 | strategic_pivot | strategy_pivot | decided | high | 🏛 経営 |
| 2 | 中国レアアース/ガリウム/ゲルマニウム輸出許可制強化→SX重金属回収事業の追い風 | ip_regulatory | external_regulation | (state なし) | high | 🌐 外部 |
| 3 | ダイキアクシス (DAVP) との関係深化・出資・共同開発の距離感を経営判断未了 | management_decision | **partnership** | **pending** | critical | **🚀 事業** ← #26 修正 |
| 4 | JAFCOとのDD継続合意・投資委員会上程準備へ | funding | funding | pending (= 上程準備中) | critical | 🏛 経営 |
| 5 | CEO候補の検討開始・株式先決方針を合意 | management_decision | strategy_pivot | pending | high | 🏛 経営 |

→ #3 ダイキアクシス が唯一「現状 type が違う」ケース。残り 5 件は 現状 type のままで OK。
→ 修正 prompt の効果: 「partner との議論は必ず partnership」ルールで #3 を正しく振れる。

## カード表示 (案 F-1) before/after

**before**:
```
[5/21] [🏛] [方針決定] [critical] [候補] [決定]
ダイキアクシス (DAVP) との関係深化・出資・共同開発の距離感を経営判断未了
(PSI Step2 事業化推進機関として既に参画)
```

→ chip 6 個、意味不明、紛らわしい

**after**:
```
[5/21] [🚀 提携] [critical] ⚠️ 未確認
ダイキアクシス (DAVP) との関係深化・出資・共同開発の距離感を経営判断未了
(PSI Step2 事業化推進機関として既に参画)
```

→ chip 3 個、4 分類カラーと type 名は 1 chip にまとめ、状態は本文で表現、candidate は控えめに「⚠️ 未確認」注釈

---

## 残設計事項 (= 次セッション)

1. **セクション名最終確定** (= 経営トピックス / 重要トピックス / 事業ハイライト ほか、まさ意思決定)
2. **signal_type 改名 + 統合の最終確定** (案 C-1 ベース / 案 C-2 にする / 別案)
3. **decision_state の 3 段階化 or 撤廃** (案 D-1 ベース / 別案)
4. **DB 再 label の実施計画** (= 既存 signal を新 type に手動で振り分け、+ migration)
5. **Codex automation の LLM prompt 更新依頼** (= まさのローカル `.codex/` 配下を触る or scheduled task で更新)
6. **MTGサマリ・MS リストとの関係整理** (= 「経営トピックス」と「MTG サマリ」と「MS 進捗」の使い分けを明文化、cockpit 全体の情報設計)
