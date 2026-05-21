# マクロトレンド -> Atlas -> Seeds 再設計

最終更新: 2026-05-19

## 問題意識

現行の `/atlas/divergence` は有用だが、これは「マクロトレンドマップ」ではなく、各テーマについて「世界と日本の差分」を抽出するページになっている。

- 現行ページが答えている問い: 「このテーマでは、世界と日本の間にどんな差分があるか」
- 必要なマクロトレンド層が答える問い: 「世界ではどんな構造課題が起きていて、今後数十年で世界はどう変わるのか。その変化の中で AMD が見るべき技術テーマ・研究シーズ・事業機会は何か」

したがって階層は、次のように組み替える。

```text
現状:
Atlas テーマ
  -> 世界 / 日本の差分
  -> 関連シグナル

Seeds リスト
  -> 独立した研究シーズ一覧
```

```text
目標:
マクロトレンド
  -> 世界の構造課題クラスター
  -> 10年〜30年の変化仮説
  -> Atlas 由来の根拠シグナル
  -> テーマ別の世界 / 日本差分
  -> 課題ごとに紐づく Seeds
  -> AMD の探索 / 接触 / 事業化判断
```

## 基本コンセプト

マクロトレンドを最上位の操作地図にする。Atlas と Seeds は、その下にぶら下がる根拠レイヤーとして扱う。

| レイヤー | 役割 | 既存 / 新規データ候補 |
|---|---|---|
| マクロトレンド課題 | 日本固有の差分ではなく、世界で起きている構造課題 | 新規 `macrotrend_issues` |
| 変化仮説 | 2030 / 2040 / 2050 に向けた世界変化の見立て | 新規 `macrotrend_theses` |
| Atlas 根拠 | 仮説を支持・反証する政策、ニュース、論文、投資、統計 | `atlas_signals`, `atlas_stories`, `atlas_themes` |
| 世界 / 日本差分 | その課題について日本が世界とどうズレているか | 既存 `atlas_divergences` を子ビュー化 |
| Seeds | 課題ごとに分類された研究シーズ、実装シーズ | `seeds` + 新規 `macrotrend_seed_links` |
| AMD 判断 | 見る、会う、育てる、保留する、捨てる | `atlas_decisions`, 将来の PJ link |

## データモデル案

### `macrotrend_issues`

世界の構造課題クラスターを表す親テーブル。

想定カラム:

- `id`
- `slug`
- `title`
- `summary`
- `global_problem`: 世界で起きている課題の要約
- `why_now`: なぜ今 AMD が見るべきか
- `time_horizon`: `2030 | 2040 | 2050 | mixed`
- `status`: `active | watch | archived`
- `priority`: `1-5`
- `created_at`
- `updated_at`

課題例:

- エネルギー余剰化と送配電不安定化
- 高齢化とケア労働不足
- 資源循環と重要鉱物制約
- 食料・水・気候適応
- 自律生産と Physical AI
- 地政学的分断とサプライチェーン再編

### `macrotrend_theses`

1つの課題に複数の変化仮説を持たせる。

- `id`
- `issue_id`
- `horizon_year`
- `thesis`: 変化仮説
- `expected_change`: 何がどう変わるか
- `uncertainty`: 不確実性
- `leading_indicators`: 先行指標
- `source_refs`: 根拠URL / signal id
- `confidence`: 確信度
- `generated_at`

### `macrotrend_atlas_links`

マクロトレンド課題と Atlas 側の素材を結びつける join。

- `issue_id`
- `atlas_signal_id`
- `atlas_story_id`
- `atlas_theme_id`
- `relation`: `supports | weakens | watch | japan_gap`
- `strength`: `0-1`
- `reason`

### `macrotrend_seed_links`

研究シーズをマクロトレンド課題ごとに束ねる join。

- `issue_id`
- `seed_id`
- `relation`: `direct_solution | enabling_tech | adjacent | weak`
- `problem_fit`: `0-1`
- `commercial_timing`: `now | 3y | 10y | long`
- `reason`

## UI構造案

### `/atlas/macrotrends`

新しい最上位のマクロトレンドマップ。

ファーストビュー:

- 世界変化の総括
- 上位5件の構造課題クラスター
- 各課題の `根拠量 / 緊急度 / 不確実性 / Seeds カバー率`
- 2030 / 2040 / 2050 に向けて「世界がどちらへ動いているか」の要約

課題詳細:

- 課題の要約
- 10年〜30年の変化仮説
- 先行指標
- Atlas 根拠ストリーム
- 世界 / 日本差分の子パネル
- 解決角度ごとに分類された Seeds
- AMD の次アクション

### 既存 `/atlas/divergence`

既存ページは残す。ただし概念名は次の扱いにする。

```text
World / Japan Divergence Map
```

これはマクロトレンドの子分析ビューであって、最上位のマクロトレンドそのものではない。

### `/seeds`

Seeds にはマクロトレンド別グルーピングを追加する。

- 既存の一覧表示は残す
- 新しい表示: `マクロトレンド課題 -> 解決角度 -> Seeds`
- 各 Seed card に、紐づく課題と relation type を表示する

## 情報収集 / cron 再設計案

現行の収集は、まず汎用的な Atlas signal を作り、その後にテーマや差分を派生させる流れが中心。新構造では、安い収集と重い統合判断を分離する。

### Stage 1: 安い一次収集

Vercel cron または既存 collector で、決定論的に取れるものを集める。

- 政策 collector
- macro news collector
- 論文 / OpenAlex collector
- Seeds ingest
- VC / investment ingest

出力は今まで通り、低コストな raw data に寄せる。

- `atlas_signals`
- `papers_log`
- `seeds`
- `vc_news`
- `observation_log`

### Stage 2: Codex automation による統合レビュー

LLM が必要な高コスト処理は、Codex automation で agentic review として回す。直近の証拠を読み、構造課題・仮説・Seeds link の提案を JSON outbox として作る。

automation 案:

```text
AMD Macrotrend Issue Review

頻度:
  daily light または週3回

入力:
  - 直近の atlas_signals
  - 新規 seed discoveries
  - papers_log の差分
  - 既存 macrotrend_issues / theses

出力:
  - 新しい macrotrend issue の提案
  - 既存 issue summary / thesis の更新案
  - issue <-> atlas link 案
  - issue <-> seed link 案
  - uncertainty / priority の更新案
```

automation は DB に直接大量書き込みしない。まず JSON outbox を吐き、schema validation 後に apply script/API が反映する。

### Stage 3: 決定論的 apply

DB 書き込みは小さく、検証可能な経路に限定する。

- `pwa/scripts/macrotrend_review_tool.mjs apply-outbox`
- または `/api/macrotrend/review-ingest`
- ID と source URL を検証
- issue / thesis / link row を upsert
- 長い LLM route が複数 table を直接 mutate しない

### Stage 4: 重めの定期 refresh

Vercel cron は、範囲が明確で predictable な処理だけに使う。

- `macrotrend-aggregate-indicators`: 月次、件数や金額などの決定論集計
- `macrotrend-divergence-refresh`: 週次、issue/theme 単位
- `macrotrend-seed-link-refresh`: 週次、新規 Seeds だけ

Codex automation に寄せる処理:

- 新課題の発見
- 変化仮説の書き換え
- 根拠が支持 / 反証 / watch のどれかの判断
- Seed がどの課題に効くかの problem-fit 判断

## トークン予算ポリシー

推奨分担:

- Vercel cron: fetch / parse / normalize / aggregate まで
- Codex automation: 小さい入力窓での高コスト reasoning と outbox 生成
- 手動 UI review: 影響が大きい issue / thesis 変更の accept / reject

標準 cadence:

- daily light review: 直近48h signal、最大80 title
- weekly deep review: active macrotrend issue ごとに強い根拠20件まで
- monthly thesis refresh: 2030 / 2040 / 2050 要約の更新

停止条件:

- source freshness が弱い場合は DB 変更なしで `insufficient evidence`
- schema validation に落ちた場合は部分反映しない

## UI Fidelity Pass Queue (2026-05-19)

次回のMacrotrend修正は、マインドマップを主役に戻すところから入る。

1. マインドマップ的なコンテンツが最重要なので、`/hud/atlas/macrotrends` / `/atlas/macrotrends` ではmindmapをfirst viewport上位へ移動する。文字だけの説明・補足・根拠文は下へ送る。
2. Macrotrendの主分類は、AMD Score / M算定と同じ ASPI 8 domain に揃える。UN SDGs / WEF Global Risks Report 2026 は上位分類ではなく、ASPI domain nodeへ重ねるrisk / issue networkとして扱う。
3. Macrotrend mapのinteractionはAtlas Mapと揃える。
   - node dragで隣接nodeも連動して引っ張られる。
   - 空白dragでmap全体がpanする。
   - ASPI 8 domain配下の子nodeは初期表示から開く。node clickは選択/フォーカス用途とし、drag移動したpointerではclickを発火させない。
   - motion timing / easing / drag feelを `/hud/atlas/map` と比較しながら寄せる。
4. Seedsは全部node化しない。論文数は小項目課題node上の数字として表示し、必要なときだけ関連Seedsへ掘れる構造にする。

次セッションの最初の実装作業は、`/hud/atlas/map` のdrag / pan / expand実装を読み、Macrotrend側へ同じ操作感を移植できる境界を特定すること。

### 実装メモ (2026-05-19 Macrotrend fidelity pass)

- `/atlas/macrotrends` / `/hud/atlas/macrotrends` は、first viewportで `MacrotrendMindmap` を主役にする。説明文・根拠資料・Selected Domain詳細はmap下へ送る。
- 初期表示ではASPI 8 domain配下の小項目nodeまで全て表示する。domain / sub node clickは選択とフォーカス用途で、位置調整drag後にはclickを発火させない。
- 空白dragはmap全体pan、node dragは隣接nodeを `0.38` 比率で連動移動する。click後の位置変化はAtlas Mapの `centerAt(..., 600)` に合わせて600ms / ease-out系に寄せる。
- Seedsはnode化しない。小項目nodeに `NN papers` と `seeds N` を表示し、具体Seedsは下段の `Seeds by Issue` panelから掘る。
- 2026-05-19レビューで、5テーマ分類はUI都合の圧縮に寄りすぎていたため正本分類から外す。primary taxonomyは ASPI Critical Technology Tracker 8 domain、UN / WEF はrisk network overlay、旧5テーマは必要な場合だけAMD focus presetとして扱う。

### 方針修正 (2026-05-19 ASPI 8 domain alignment)

まさレビューで「元文献は5分類を定義しているわけではなく、WEFは33 risksのネットワーク、UNは17 goals / 169 targetsではないか」「AMD ScoreのM算定でASPI 8 domainを使っているなら、Macrotrendも同じ分類でよいのでは」と指摘あり。

この指摘を正として、Macrotrend画面の分類方針を以下に修正する。

- **primary taxonomy** は AMD Score / M算定 / `papers_log` / `macro_index_log` / `project_ventures.lanes` と同じ **ASPI Critical Technology Tracker 8 domain** に揃える。
- UN SDGs / WEF Global Risks Report 2026 は、上位分類ではなく **source-derived risk / issue network** としてASPI domain nodeに重ねる。
- 以前の5テーマは正本分類にしない。必要な場合だけ「AMD focus preset」や表示フィルタとして扱う。
- UI都合で新しい分類を発明する前に、既存の算定体系・DB設計・seed設計と整合するかを確認する。
- node dragは位置編集の意図として扱う。drag移動が発生したpointerではclick展開を発火させない。
- ASPI 8 domain + 小項目nodeの総量なら、初期状態で子nodeまで開いていたほうが探索地図として自然。collapse/expandを主操作にせず、pan / drag / selectを主操作にする。

### 追加方針 (2026-05-20 Decision Map pass)

まさレビューで「8つの大分類と中分類だけでは情報量が少ない。目的と設計をセットで考えるべき」と指摘あり。

Macrotrend Mapの目的は、世界課題を説明することではなく、**AMDが次にどこを掘るべきかを決めること**。

そのためUIは以下のレイヤーを同時に見せる。

- ASPI 8 domain node: AMD Score/M算定と同じ正本分類。
- Issue node: ASPI domain配下の小課題。初期表示で全展開。
- Evidence metrics: `papers` / `news` / `diff` / `seeds` / `momentum` / `coverage` / `gap`。
- AMD Action: `Seed search` / `Japan gap review` / `Atlas synthesis` / `Venture thesis` / `Evidence watch`。
- Detail panel: 選択したdomain/issueの根拠、source、次アクションを右側に出す。

Seedsは全部node化しない。seed数はissue nodeのcoverageとして表示し、具体Seedsは下段panelやSeeds画面で掘る。
