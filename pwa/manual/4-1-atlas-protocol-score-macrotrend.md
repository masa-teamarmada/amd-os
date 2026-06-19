# 判断エンジン — Atlas / Macrotrend / AMD Score / AMD Protocol

AMD OS の判断エンジン側を俯瞰する章。PJ コックピットが「いま各 PJ がどう動いているか」を見る場所だとすると、この章の対象は **何を見るか / どう評価するか / どう判断を資産化するか**。

## 4 つの役割

| 領域 | 一言でいうと | 主な問い | 主な場所 |
|---|---|---|---|
| **Macrotrend** | 世界の構造変化の地図 | 10-30 年で何が変わり、AMD はどの課題を見るべきか | `/atlas/macrotrends` |
| **Atlas** | 判断材料の蓄積地図 | どのニュース・政策・論文・投資が、PJ や Seeds の前提を動かすか | `/atlas`, `/atlas/inbox`, `/atlas/map`, `/atlas/decisions`, `/atlas/divergence` |
| **AMD Score** | PJ / SU の価値・成熟度スコア | この PJ は Macrotrend に乗り、XRL が整い、FRL が牽引できる状態か | `各 PJ cockpit`, `/venture-map/amd-score` |
| **AMD Protocol** | 判断パターンの知財化 | 似た分岐点にまた出会った時、どの判断材料でどう動くか | `/admin/protocols`, `protocols`, `protocol_examples` |

`AMD Management Score` はこの 4 つと関係するが、役割は別。これは **会社全体の経営健康度**を見る p00 向けスコア。

## 全体フロー

```text
世界の構造課題 / 10-30年の変化仮説
        ↓
Macrotrend
        ↓  課題・仮説に根拠を紐づける
Atlas signals / stories / decisions
        ↓
┌──────────────────────────────┐
│  PJ / Seeds への影響を見る       │
└──────────────────────────────┘
        ↓
AMD Score
  M = Macrotrend / Triple Helix
  X = TRL / BRL / GRL / SRL / HRL
  F = FRL
        ↓
まさえいMTG / PJ MTG / 月次レビュー
        ↓
AMD Protocol
  分岐点 -> 判断材料 -> アクション -> 結果観測
        ↓
次の似た判断で再利用
```

## Macrotrend

Macrotrend は、単発ニュースの一覧ではなく **世界の構造課題クラスター**を見るレイヤー。

見るもの:
- 世界で起きている構造課題
- 2030 / 2040 / 2050 に向けた変化仮説
- 先行指標
- Atlas 根拠 (= 政策、ニュース、論文、投資、統計)
- 世界 / 日本差分
- 紐づく Seeds / PJ / AMD の次アクション

現状の設計では、Atlas signal の domain は A-R の細かい分類で保存し、Macrotrend 側の上位分類は ASPI Critical Technology Tracker 系の大きな技術領域へ寄せる方針。UN SDGs や WEF Global Risks は主分類ではなく、課題を見るための overlay として使う。

## Atlas

Atlas は、AMD が見るべき外部シグナルを蓄積し、後から判断材料として使う地図。

主な画面:
- `/atlas`: Atlas の入口
- `/atlas/inbox`: 外部シグナル候補の確認
- `/atlas/map`: signal / project / decision の地図
- `/atlas/macrotrends`: Macrotrend 課題の上位ビュー
- `/atlas/divergence`: 世界 / 日本差分
- `/atlas/decisions`: Atlas 由来の判断ログ

運用:
- Codex automation `amd-atlas-2` が daily 08:10 JST 目安で外部マクロ signal を作る
- 出力先は `/Users/masa/.codex/automations/amd-atlas/outbox/*.json`
- LaunchAgent が outbox を拾い、`/api/atlas/signals-ingest` 経由で Supabase に入れる
- Atlas は AMD OS 内部の 5 生データ差分レビューとは混ぜない。外部マクロ専用

## AMD Score

AMD Score は、PJ / SU 単位の価値・成熟度を見るスコア。現行 primary は PRS (`P x R x S`)。Before Zero Theory v3.2 の M-X-F / 7軸 Cobb-Douglas は legacy comparison と evidence chain として残す。

$$
\mathrm{Score}_{\mathrm{PRS}} = K_{\mathrm{PRS}}\cdot P\cdot R\cdot S
$$

$$
R=\prod_{x \in \{\mathrm{TRL},\mathrm{BRL},\mathrm{GRL},\mathrm{SRL},\mathrm{HRL}\}}(x+1)^{\alpha_x}
$$

$$
S=(\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma}
\cdot(\mathrm{FRL}_{\mathrm{final}}+1)^{\alpha_F}
\cdot(R_{\mathrm{net}}+1)^{\alpha_{R_{\mathrm{net}}}}
$$

Legacy comparison:

| 要素 | 読み方 |
|---|---|
| `M` | Macrotrend / Triple Helix |
| `X` | 5 XRL readiness |
| `F` | Founder / CEO leadership readiness |

読む時のポイント:
- `P` は潜在規模、`R` は会社側 readiness、`S` は生存性・収益化耐性を見る
- `P/R_net` missing 時は review pending とし、legacy AMD を primary へ戻さない
- `M` は外部環境。Macrotrend と Triple Helix (= 学術 / 産業 / 政府) の追い風を見る
- `X` は会社側の readiness。TRL / BRL / GRL / SRL / HRL を見る
- `F` は牽引する人側の readiness。FRL として扱う
- 律速軸は「1 段階上げた時に score が一番増える軸」。次の経営介入候補になる

## AMD Protocol

AMD Protocol は、AMD の経営判断を **再利用できる判断パターン**として残す L2。

構造:
- `protocols`: 普遍的な意思決定パターン。固有 PJ 名・固有人名に寄せず、横展開できる形で残す
- `protocol_examples`: 具体事例。どの PJ で、いつ、どの分岐点が起きたかを紐づける
- `protocol_result_observations`: 判断後の結果観測。短期 / 中期 / 長期で append-only に積む

4 要素:
1. **分岐点**: どの選択肢があったか
2. **判断材料**: どの情報を見て判断したか
3. **アクション**: どの方針を採ったか
4. **結果**: 実際に何が起きたか。自動抽出で推測して埋めない

現状 (= 2026-05-29):
- 旧 writer の GAS 155 は 2026-05-22 に停止
- D-1 AMD Protocol の現行 writer は MMOマシン Codex Desktop automation `amd-os-l2-protocol-extract`
- 復旧時は [3-2 章](3-2-data-and-extraction.md) / [8-3 章](8-3-l2-extraction-routines-spec.md) の実行場所つき表を見る

## AMD Management Score との違い

| スコア | 対象 | 見るもの |
|---|---|---|
| **AMD Score** | PJ / SU | Macrotrend, XRL, FRL に基づく価値・成熟度 |
| **AMD Management Score** | AMD 全社 (= p00) | 先手力、財務耐久、既存 PJ 継続、新規獲得、戦略接近度 |

混ぜない。PJ の価値を見る時は AMD Score、会社として今月良くなったかを見る時は AMD Management Score。

## どこを直す時に何を見るか

| 直したいもの | まず読む md |
|---|---|
| OS 全体の画面・データ・自動処理 | [3-1 章 全体設計](3-1-system-architecture.md) |
| Atlas の signal / inbox / 外部マクロ運用 | [`pwa/design/atlas.md`](../design/atlas.md), [`pwa/design/atlas_routine.md`](../design/atlas_routine.md) |
| Macrotrend と Seeds の階層 | [`pwa/design/macrotrend_atlas_seeds_architecture.md`](../design/macrotrend_atlas_seeds_architecture.md) |
| Atlas / Seeds / VC / Scholar の使い方 | [2-5 章 探索系アセット](2-5-research-assets-quick-start.md) |
| HUD / Venture Map の数理モデル・実験ビュー | [5-2 章 HUD / Venture Map](5-2-hud-and-venture-map-spec.md) |
| AMD Score の式・UI・軸の意味 | [4-3 章 AMD Score 詳細仕様](4-3-amd-score-spec.md), [`pwa/design/amd_score.md`](../design/amd_score.md) |
| AMD Management Score | [`pwa/design/management_score.md`](../design/management_score.md) |
| AMD Protocol | [`pwa/design/amd_protocol.md`](../design/amd_protocol.md) |
| 通知・修正依頼・正本反映ゲート | [3-3 章 通知・つくよみ](3-3-notifications-and-tsukuyomi.md) |
| 自動処理の稼働状態 | [6-1 章 Operations Settings](6-1-operations-settings-spec.md), [9-1 章 5.4 責務分担マトリクス](9-1-decisions-and-history.md#54-codex--claude--vercel--launchagent-責務分担マトリクス) |
