# AMD Atlas — マクロ判断の蓄積・可視化プロダクト

## 2026-04-22: 構想スタート

### 背景
- 中東情勢 × 半導体価格高騰 → 産業界で「脱ヘリウム」の流れ、など**マクロトレンドの把握**がAMDの事業判断に不可欠
- 「リチウムは高騰するか」「ハフニウムで新規事業は成立するか」といった論点に、AMDとして高い視点で答えたい
- 単発で情報を取るのではなく、**蓄積して資産化**したい
- 「あのとき、あの技術シーズで起業しておくべきだった」を後付けで検出できる仕組みが欲しい

### 決定
AMD OSの**新プロダクト/新タブ**として **AMD Atlas** を立ち上げる。
AMDプロンプト（判断のフレーム）と並ぶ、AMD OSの**2本柱の一方**として位置付ける。

### 命名の理由
- ARMADA（無敵艦隊＝航海モチーフ）との世界観統一
- アトラス神話: 世界を肩に担ぐ巨人 → AMDが世界のイノベーションを支える
- アトラス（地図帳）: 知を俯瞰する蓄積体
- マインドマップUIと機能的に一致（知の地図）
- 時間軸に中立: 過去・現在・未来すべてをカバーできる

---

## 提供価値

### AMD OSの2本柱
| 柱 | 機能 | 本質 |
|---|---|---|
| **AMDプロンプト** | 判断のフレーム | *どう*考えるか |
| **AMD Atlas** | 判断の地図 | *何を*見て考えるか |

この2つに加え、**判断結果の履歴**が乗ることで三角形が完成する：
```
      [AMDプロンプト]
         ＼   ／
          判断
         ／   ＼
  [Atlas]   [判断結果ログ]
         ＼   ／
          PDCA
```

### 独自性
- 投資家は「株価に効くか」で情報を取るが、AMDは「**新規事業の成立性・既存PJの前提が揺らぐか**」で取る
- 単発のニュース要約ではなく、**論点（topic）単位で時系列に追記**することで、数年後も使える資産になる
- 「スルーした論点」の**現在価値**を定期評価 → 判断精度を学習する

---

## 機能構造

### メインサブ機能
- **Atlas Map**: グラフビュー（浮遊するマインドマップ）
- **Atlas Inbox**: えいみが収集したシグナル候補をスワイプでキュレーション
- **Atlas Topics**: 論点（topic）の一覧・詳細
- **Atlas Decisions**: AMDの判断ログと振り返り
- **Atlas Signals**: 生のニュース・データソース

### ノード種別（グラフ構造）
- `topic`: 論点そのもの（例: ヘリウム脱却、リチウム価格動向）
- `signal`: 個別ニュース・データ（シグナル）
- `decision`: AMDの判断イベント
- `project`: AMDのPJ（既存の `DB_ProjectKnowledge` と接続）
- `technology`: 技術シーズ
- `material`: 素材・原料
- `market`: 市場・産業

### エッジ種別
- `affects`: topic→PJ（影響を与える）
- `derived_from`: signal→topic（この記事からこの論点が生まれた）
- `triggered`: topic→decision（この論点がこの判断を呼んだ）
- `related_to`: topic↔topic（関連論点）
- `depends_on`: technology→material
- `competes_with`: technology↔technology

---

## データモデル（Supabase）

```sql
atlas_nodes (
  id uuid PK,
  type text,              -- topic/signal/decision/project/technology/material/market
  title text,
  summary text,           -- 最新サマリ（都度上書き）
  metadata jsonb,         -- type別の可変データ
  importance text,        -- high/medium/low
  status text,            -- active/archived/spawned
  tags text[],
  last_updated timestamptz,
  created_at timestamptz
)

atlas_edges (
  id uuid PK,
  from_node uuid,
  to_node uuid,
  relation_type text,
  strength numeric,       -- 関連の強さ（0-1）
  note text,
  created_at timestamptz
)

atlas_observations (
  id uuid PK,
  node_id uuid,
  observed_at timestamptz,
  content text,
  source_url text,
  source_type text        -- news/report/data/manual
)

atlas_decisions (
  id uuid PK,
  topic_id uuid,
  decided_at timestamptz,
  action text,            -- 起業/スタジオ/支援/スルー/保留
  rationale text,
  outcome_eval_at timestamptz,   -- 振り返り予定日
  outcome text            -- 評価結果（後から追記）
)
```

---

## UI設計

### マインドマップビュー
- 現行ライブラリ: `react-force-graph-2d`
- 現行 node: `atlas_stories` の story node のみ。signal / project / decision は detail / link 先として扱い、同じ canvas には混ぜない
- **色**: `primary_domain` の ATL A-R domain
- **サイズ**: signal 数 + high importance
- **強調**: high importance かつ signal 3 件以上は pulse、直近24h更新は `NEW`
- **時間軸**: `all` / `30d` / `7d` / `24h` の time range filter

### インタラクション
- **タップ**: そのノードを中心に再レイアウト、詳細パネル展開
- **ドラッグ**: その node を固定し、他 node の古い pin は解除
- **フィルタ**: domain 複数選択、tag 複数選択、time range
- **詳細**: story summary、signal timeline、source URL、story tags
- **未実装**: graph 上から派生論点を新規作成、project/decision node 混在、ノード間 path search

### Inbox UI
- えいみが週次で投下したsignal候補がカードで並ぶ
- **スワイプ**: 右=採択、左=却下、上=保留
- 採択: topic化 or 既存topicに追記
- 1日5分で未来を仕込める体験

### 2026-05-25 現行 Atlas Map force layout

`/atlas/map` は一度中央密集 + 外周ドーナツ + 数秒後の再縮小が起きたため、力場を構造的に固定している。詳細正本は [manual/4-2-atlas-macrotrend-signal-spec.md](../manual/4-2-atlas-macrotrend-signal-spec.md)。

| 項目 | 現行値 |
|---|---|
| initial position | domain 角度 + `RADIUS=3000` + jitter |
| center force | `null` |
| radial domain force | `0.15 * alpha` |
| hard collide | `(ra+rb)*8`, alpha 非依存 |
| charge | `-30000` |
| link | `distance=600`, `strength=0.05` |
| cooldown | `cooldownTime=8000` |
| engine stop | 空 handler。`zoomToFit` しない |

2026-05-25 #65 に production `/atlas/map` をブラウザ確認。`183 stories · 144 共通テーマ接続`、canvas、凡例、domain/tag filters が表示されている。

---

## ワークフロー

```
[えいみ: 週次WebSearch収集]
         ↓
    Atlas Inbox（signal候補）
         ↓
[まさ: スワイプでキュレーション]
   採択 / 保留 / 却下
         ↓
  採択 → topic昇格 or 既存topicに追記
         ↓
[提案前の論点整理: 議論]
   議論ログも topic の子ノードとして記録
         ↓
[まさ: 判断]
   起業 / スタジオ / 支援 / スルー / 保留
         ↓
  decisionノード生成、PJに繋がる場合はprojectノードへリンク
         ↓
[時間経過]
   えいみが定期的に「その後」を追記
   outcome_eval_at が来たら振り返りアラート
```

---

## 実装フェーズ

| Phase | やること | 備考 |
|---|---|---|
| **0. md試作（今週）** | `AMD_Business/全社/macro/` でmd運用開始 | フォーマット検証、watchlist作成 |
| **1. Supabase化 + PWA読み取り** | テーブル作成、Atlas Topicsの一覧ページ | `/atlas/topics` ルート追加 |
| **2. Inbox + スワイプUI** | 週次でえいみが投下、まさがキュレーション | 運用が回る形 |
| **3. グラフビュー** | react-force-graph でマインドマップ | `/atlas/map` ルート追加 |
| **4. Decisions + 振り返り** | decisionノード、outcome評価、ギャップ検出 | PDCA完成 |
| **5. AMDプロンプト統合** | 判断時にtopicが文脈として入る | 2本柱が融合 |

### Phase 0 の具体タスク（今週着手）
1. `AMD_Business/全社/macro/watchlist.md` 作成（各PJ×監視変数の棚卸し）
2. `topics/` 配下に1本サンプル（例: `helium_cooling.md`）を書く
3. 週次レポートのフォーマット案を決める
4. scheduled-tasks でえいみの自動収集を試す

---

## PWA実装の位置付け

### ナビゲーション
現在のタブ: Dashboard / Admin / 立替 / 設定
→ **Atlas** を Dashboard と Admin の間に追加

### ルート案
- `/atlas` → accepted signal / story の一覧と story 操作
- `/atlas/map` → story node graph
- `/atlas/inbox` → signal review
- `/atlas/inbox/submit` → manual signal submit
- `/atlas/admin/themes` → story theme cluster / apply
- `/atlas/macrotrends` → ASPI 8 domain の上位課題地図
- `/atlas/divergence` → theme 単位の世界 / 日本差分
- `/atlas/decisions` → 判断ログ

---

## 将来的な外販可能性（遠い未来の話）

AMDの判断データで磨き込んだあと、以下への展開余地：
- **CVC**: 自社事業領域のマクロトレンド追跡サービス
- **大学TLO**: 技術シーズの商業化タイミング判定
- **スタートアップ**: 参入領域の構造変化モニタリング

AMD OSのプレミアム機能 or 別プロダクトとしてのスピンアウト。
ただし、最初はAMD社内での価値検証が先。

---

## 開いた論点・次セッションで詰めること

- [x] Supabaseテーブル設計の詳細化とmigration
- [x] グラフライブラリの比較検証（現行は react-force-graph-2d）
- [ ] AMDプロンプトとの統合方法（topic文脈の注入インターフェース）
- [ ] 「スルー判断」の振り返り評価ロジック（何をもってギャップとするか）
- [ ] 即時Push配信（Web Push + APNs）の実装
- [x] えいみの自動収集のジョブ設計（現行主系は Codex automation `amd-atlas-2` + local applier）

---

## 2026-04-22（続）: 方針の根本修正

初期設計ではPJ別watchlistを主軸にしていたが、まさの指摘で方針転換。

### 修正1: PJ依存のフィルタリングをやめる
**背景**: AMDは新規シーズ開拓の仕事が今後増える。PJベースで情報を絞ると、視野の外で生まれる次のシーズを見逃す。  
**決定**: watchlistを**分野別（13分野）**に再構成。PJ影響は各変数の副次タグにすぎない。新規シーズ候補（PJ化されていない領域）も明示的に含める。  
**影響**: watchlist.mdを全面書き直し。現在の13分野構成は A.地政学 / B.規制 / C.素材 / D.エネルギー / E.製造・プロセス / F.バイオ・医療 / G.モビリティ・ロボティクス / H.建築・インフラ / I.ICT・AI / J.宇宙・防衛 / K.食・農・水産 / L.金融 / M.社会構造。

### 修正2: PJ情報の更新
- **ORB**: 終了PJのためwatchlist除外（そもそも創薬でもなかった）
- **SE**: マイクロ波ワイヤレス給電の中小企業（スタートアップではない）
- **ZMP**: 本業=葛飾ロード（道路保守点検・予防保全・清掃・災害派遣）。新規事業=ドローン（保守点検DX等）・水素（小型水素ステーション・補助金申請支援）・CBRE倉庫地域貢献棟運営

### 修正3: 配信設計の強化 — 日次Pushが主役
**背景**: MTG前にマクロ変化を把握していないと信用を失う。週次レポートでは遅すぎる。  
**決定**: 配信階層を4段に再設計：
1. **即時Push通知**（watchlist highで閾値超 / 大型M&A / 規制施行）→ PWA Web Push + Swift APNs
2. **デイリーダイジェスト**（毎朝6:30 JST）
3. **週次レポート**（毎週月曜）
4. **月次深掘り**（月末）

### 修正4: PWA + Swift 両対応
**背景**: 外出先でも通知を受け、素早く情報を取りたい。PCを開かないと見られないのでは意味がない。  
**決定**: **Atlas / Protocol（AMDプロンプト）の両方**をPWA + Swift両対応で実装。
- PWA: 全機能（閲覧・編集・議論・キュレーション・グラフビュー）
- Swift: 閲覧中心（Push受信・topic閲覧・Inboxスワイプ）、詳細編集はPWAへ誘導

### 修正5: 実装順序の変更
1. Phase 0（今週）: md試作
2. Phase 1: **PWA実装**（UIで動作確認が先）
3. Phase 2: PWAでレポートテスト
4. Phase 3: 通知基盤（Web Push + APNs準備）
5. Phase 4: **Swift実装**（PWAで筋が固まってから）
6. Phase 5以降: Decisions / グラフビュー / Protocol統合
