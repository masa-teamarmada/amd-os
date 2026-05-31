# 研究機関 ERS (機関エコシステム整備度) 詳細仕様

AMD は香川大・KUTE・NIMS など複数の研究機関で **エコシステム構築業務** を請け負っている。各機関が「何をできていて／何が未整備で／どんな特徴を持つか」を一覧・比較し、整備度を 0–100% でスコアリングする指標が **ERS (Ecosystem Readiness Score / 機関エコシステム整備度)**。整備のギャップ (= AMD が次に売れる支援メニュー) を可視化するのが目的。設計正本は [`pwa/design/institution_readiness.md`](../design/institution_readiness.md)。

> **先にここだけ読む**: ERS は **苗床／土壌レイヤー**の指標で、ベンチャー個体の [AMD Score](4-3-amd-score-spec.md) (= 個体レイヤー) とは **別ロジック・別画面**。ERS を AMD Score の計算式に足し込まない (= 二重計上禁止)。両者は σ_SU 経由で「概念的に」連動するだけ。

## AMD Score との関係 (= 二重計上しない)

| | レイヤー | 何を測るか | スコア型 |
|---|---|---|---|
| **AMD Score** | 個体 (ベンチャー1社) | IPO に向けてどれだけ育ったか (7 軸 Cobb-Douglas、乗法) | 0–100 (1 軸でも欠けると死ぬ) |
| **ERS** | 苗床 / 土壌 (研究機関) | ベンチャーを生み育てる装置としてどれだけ整備されているか (8 軸、加重和) | 0–100% 充足率 |

- 連動は **σ_SU (Triple Helix: 学術 μ_A × 産業 μ_I × 政府 μ_G) 経由のデータ上の因果**で起きる。機関の整備が進む → そこ発のベンチャーの μ_I / μ_G が上がる → そのベンチャーの AMD Score が上がる。
- ⚠️ **ERS を PJ の AMD Score 計算式に直接足さない**。σ_SU で既に効いているので二重計上になる。計算式は別々に保つ。

## スコアの構造 (= 加重和・欠損を可視化)

AMD Score の乗法は「全軸ないと IPO 死ぬ」モデルなので**流用しない**。ERS は逆で「**何が欠けているか (= 未整備ギャップ) を見せる**」のが目的なので、欠損が掛け算で消えない **加重和 (充足率)** を使う。

```text
2 階層: capability 軸 (8) > サブ軸 / 評価ポイント (軸ごとに複数) > 各サブ軸 Lv1–5

サブ軸スコア   lv ∈ {1,2,3,4,5}
正規化         s = (lv - 1) / 4        → 0.00 / 0.25 / 0.50 / 0.75 / 1.00
軸スコア       A_k = mean(その軸の採点済サブ軸 s)   ← N/A・未評価は除外、無ければ null
ERS (充足率)   ERS = 100 · Σ_k w_k · A_k   (Σ w_k = 1、当面は等加重 1/8)
```

- 軸スコアは**サブ軸の正規化平均**。サブ軸数の偏りで軸間が勝手に重くならないよう軸を等価値に揃える。
- 重みは**軸レベルにだけ**持たせる (サブ軸には持たせない)。最初は等加重、精度が上がったら軸重みを調整する。
- Lv は「ただの 1–5」ではなく、サブ軸ごとに **到達状態の定義文 (rubric)** で固定する。Lv1=最低 / Lv3=標準 / Lv5=最高 を 3 アンカーで定義し、Lv2・Lv4 は中間補間。
- **N/A** は分母から除外する (= その機関タイプに当てはまらないサブ軸)。採点済サブ軸が 0 の軸は `null` (= 未評価) として ERS の分母からも外す。

## 8 軸 (= 機関を「ベンチャーを生む装置」として見る切り口)

| 軸 | 名前 | 対応 XRL (概念マップ) |
|---|---|---|
| 1 | シーズ発掘・技術評価体制 | TRL |
| 2 | 知財・TLO 機能 | TRL→権利化 |
| 3 | インキュベーション・起業支援 | BRL |
| 4 | 産学連携・事業会社接続窓口 | σ_SU (産業 μ_I) |
| 5 | 資金・ファンド接続 | FRL |
| 6 | 経営人材 (EIR/CXO) 供給 | HRL |
| 7 | 規程・ガバナンス整備 (ゲート的) | 制度基盤 |
| 8 | 政府・自治体・政策連携 | σ_SU (政府 μ_G) / GRL |

各軸のサブ軸 (1-a, 1-b … 8-c) と Lv1/Lv3/Lv5 の rubric 全文は設計正本 [`institution_readiness.md`](../design/institution_readiness.md) を見る。「対応 XRL」は AMD Score 軸との**供給側の対応**で、厳密な計算連動ではなく概念マップ。

## 制度比較マトリクス (= ERS raw evidence)

KUTE の大学発ベンチャー認定規程整備から、ERS は **5段階の成熟度評価** と **制度整備の証拠台帳** を分けて持つ方針にする。ERS 本体は「機関としてスタートアップ創出にどれくらい効くか」を Lv1–5 で見る。一方、規程・制度は以下のステータスで細かく持つ。

| status | 意味 |
|---|---|
| `unknown` | 未確認。資料・ヒアリング・DB の裏取りがまだない |
| `not_started` | 未整備。検討・草案も確認できない |
| `drafting` | 検討中・審議中・草案あり・委員会通過前 |
| `established` | 規程・制度として整備済み |

`unknown` と `not_started` は分ける。未確認を未整備扱いすると、ヒアリング前の大学を不当に低く採点するため。

### 認定規程で比較する主な項目

- 規程主体: 学校法人規程 / 大学規程 / ハイブリッド
- 決裁者: 認定、称号授与、更新、解除、取消、支援決定、改廃、株式/SO取得
- 認定対象: 研究成果型、知財型、教職員・学生型、卒業生・退職者、第三者代表会社
- 登記前申請: 事前相談、認定予定通知、条件付認定
- 有効期間・更新: 称号期間、更新可否、更新審査、要件再確認
- 呼称: 大学発ベンチャー / スタートアップ / 併記
- 称号使用制限: 品質保証・投資推奨・経営状態保証の否定
- 大学名・ロゴ利用: 名称、標章、ロゴ、校章の利用ルール
- 知財利用: 認定とライセンス契約の切り分け、優遇措置、有償性
- 報告・変更届: 年次報告、決算未了時代替、法人形態別書類、代表者・所在地・資本構成変更
- 取消・解除: 取消事由、称号返付、取消後表示削除、営業利用停止
- 支援申請: 認定とは別の個別申請・審査・契約
- 支援期間・対価: 称号期間と支援期間の分離、実費・有償負担
- 関係規程接続: 兼業、COI、知財、共同研究、施設利用、共有機器、研究倫理、安全保障貿易管理

### PWA/DB 実装

```text
institution_policy_items
  id, category, key, label, description, value_type, sort_order

institution_policy_assessments
  institution_id, policy_item_id
  status, attribute_value, evidence_note
  source_type, source_url, source_path
  confirmed_at, evaluator
```

2026-05-31 migration `113_institution_policy_matrix.sql` で実装済み。初期マスタは 32 件（制度整備 19 件 / 属性 13 件）。
2026-05-31 migration `114_institution_policy_assessments_admin_read.sql` で `institution_policy_assessments` の read/write は admin authenticated + service_role 限定に変更。`institution_policy_items` は公開マスタとして anon read のまま。

UI は `/institutions/assess` に全部詰め込まず、`ERS評価` / `制度整備` / `規程比較` / `根拠資料` のタブに分ける。制度整備・規程比較・根拠資料は `POST /api/institutions/policies` で 1 セルずつ upsert する。

## 画面

| 画面 | ルート | 内容 |
|---|---|---|
| 研究機関一覧・比較 (ヒートマップ) | `/institutions` | **行 = 8 軸 (左ヘッダ列に番号 + 軸名 + 対応 XRL をフル表示) / 列 = 機関** の転置ヒートマップ。最上部に総合 ERS 行 (大フォント強調)、最下部に評価済サブ軸数。セルは **indigo 単色の濃淡 (濃いほど高得点)**。ヘッダ行・列は sticky 固定。右上に「📝 評価を入力 / 編集」導線 |
| 評価入力マトリクス (admin) | `/institutions/assess` | 各サブ軸を **Lv1–5 の 5 行に展開**し各レベルの rubric をフル表示、右の各機関列は**チェックボックス**のみ。1 つにチェック = そのレベル。**どの Lv にもチェックしなければ N/A** (軸平均から除外)。各サブ軸末尾に根拠メモ行 (インライン入力)。変更は 1 セルずつ即保存 (楽観更新)、ERS リアルタイム再計算。ヘッダ行・左列 sticky |
| 機関詳細 | `/institutions/{institutionId}` | 8 軸 SVG レーダー + 軸ごとのサブ軸 rubric (現在 Lv + 根拠ノート) + 「この機関発の PJ」枠 (σ_SU への概念接続。relation データは未整備) |
| ダッシュボード下段 | `/dashboard` | 上ブロック = SU リスト (AMD Score / 個体)、**下ブロック = 研究機関リスト (ERS / 苗床)** を縦積み。どの土壌からどの個体が出るかを一望できる |

- ナビ最上部に **「研究機関」** リンク (Venture Map の隣)。
- 各レイヤーで使うスコアは別ロジック (上=AMD Score / 下=ERS 充足率) なので、研究機関リスト側に「ERS は整備度であり AMD Score とは別指標」と明示している。
- **評価の書き込み**は `POST /api/institutions/assess` (admin 限定 / `requireAdmin` 相当)。body = `{ institution_id, criterion_id, level (1–5/null), na, note }`。`institution_assessments` を **当日分 (`evaluated_at = today JST`) で `onConflict(institution_id,criterion_id,evaluated_at)` upsert** する。同日中の編集は 1 レコードに集約、過去日の評価は履歴として残り、`fetchErsBundle` は (機関 × サブ軸) ごとに最新 1 件を採用する。

## データモデル (= 4 テーブル)

migration `pwa/scripts/migrations/108_institution_readiness_ers.sql` で適用済。正確な列名は [`db_schema.md`](../design/db_schema.md) を grep する。

| テーブル | 役割 |
|---|---|
| `institutions` | 機関マスタ (名前 / タイプ / 地域 / 説明) |
| (軸定義) | 8 capability 軸 + sortOrder + 重み + 対応 XRL |
| (サブ軸 criteria 定義) | 軸ごとのサブ軸 + Lv1–5 rubric |
| `institution_assessments` | 機関 × サブ軸の評価 (Lv1–5 / N/A / 根拠ノート) |

集計ロジックは [`pwa/src/lib/ers.ts`](../src/lib/ers.ts) (`computeErs` / `normalizeLevel` / `ersScoreColor`)、データ取得は [`pwa/src/lib/ers-data.ts`](../src/lib/ers-data.ts) (`fetchErsBundle`)。

## 現在のステータス / 運用メモ

- **軸・サブ軸・rubric は確定** (2026-05-29 まさ承認)。運用しながら修正していく。
- UI・DB・集計は実装済 (v0.10.0、2026-05-30 origin/main へ)。
- **比較ヒートマップ転置 + 単色濃淡 + 総合 ERS 強調、評価入力マトリクス `/institutions/assess` + 書き込み API を実装** (2026-05-30、#100、v0.11.x)。これで まさが OS 上でポチポチ評価できる (チャットで 1 件ずつ伝える必要なし)。
- **2026-05-31 実データ本評価 84 件反映済** (3 機関 × 28 サブ軸)。最新 ERS = 香川大 44% / 工学院大 44% / NIMS 74%。根拠 note は `本評価2026-05-31` で統一し、未確認論点は note 内に明記。
- **2026-05-31 制度比較マトリクス実データ 96 件反映済** (3 機関 × 32 項目)。入力記録は [`pwa/design/institution_policy_matrix_inputs_2026-05-31.md`](../design/institution_policy_matrix_inputs_2026-05-31.md)、DB seed は `pwa/scripts/migrations/116_institution_policy_assessments_seed.sql`。香川大は公開情報で埋められる認定規則だけ入れ、支援運用・株式/SO・外部CEO/CXO/EIR・VC/金融接続は `unknown` として質問票化。KUTEは内部規程案を `drafting`、公式スタートアップ支援を `established` に分けた。NIMSは公式NIMSベンチャー援助等規程を主根拠に入力し、IP-equityなど未確認は `unknown` に残した。
- **KUTE = 工学院大学 (大学) に確定済** (seed 時の「※正式名称・タイプ要確認」は解消)。
- 機関タイプ (研究所 NIMS / 大学 香川大、国立 / 私立) で性格は違うが、**当面は軸セットを分けない**。評価精度が上がってから機関タイプ別チューニングを検討する。
- 軸7 (ガバナンス) は「整っていないと他軸が空回りする前提条件」だが、当面は等加重。将来「軸7 が低いと全体に係数で効くゲート」にする案は検討余地あり (= まずは加重和のまま、欠損可視化を優先)。
