# Venture Map / マクロトレンド可視化 — 設計（v2）

- **作成日**: 2026-05-03
- **v2 改訂**: 2026-05-03 — まさのフィードバックで方針大転換。SU軌跡主体 → マクロトレンド主体へ。
- **対象イベント**: イノベーションの最前線 #25（つくばスタートアップパーク, 2026-05-20）
- **イベント詳細**: `/Users/masa/projects/AMD/stapa/HANDOFF_event_if25.md`
- **デモ尺**: 未定（実装ビューを見ながら Part3 内で確定）

---

## 0. v1 → v2 の方針変更

### v1 の構造（廃止）
- 5レーン × 時間軸 × ピンの軌跡線
- マクロ波は背景の薄い濃淡
- → SUの軌跡が主役、マクロが背景。**「AMD自慢ビュー」になり地域ファンドの説得には弱い**

### v2 の構造（採用）
- **マクロトレンドが主役**。SUは「指数の高さに打つ点」だけ
- マクロを定量化して縦軸に置く（折れ線グラフ）
- 論文数を第二縦軸として重ねる → **マクロと論文の乖離を可視化** = AMDの判断指標
- View A（時系列）+ View B（現時点スナップショット）+ View C（モデル数式）の3ビュー構成
- SU個別の TRL/BRL/HRL × マクロ重ね合わせは別ビュー（or サブ折りたたみ）

**主張**: AMD はマクロを定量化し、その指数の波の頂点に SU を立ててきた。ここまで数式化して経営判断している DT スタジオは日本に他にない。

---

## 1. プロダクト構造

```
[既存] Atlas（マクロトレンド原データ）
   │  atlas_signals / atlas_themes / atlas_divergences / policy収集cron
   │  ※ atlas_themes の選定はまだ甘い、改善余地あり
   │
   └─→ [新規] MacroIndex（マクロ指数算出層）
   │     atlas_signals/atlas_themes を集計して領域別マクロ指数を算出
   │     LLM で重みベクトルを定期再学習
   │
   └─→ [新規] Papers（論文集計層）
   │     OpenAlex / J-STAGE / Lens / Elsevier 等から領域別論文数を集計
   │     atlas_themes と整合する領域タグを使用
   │
   └─→ [新規] Seeds（研究シーズ在庫）
   │     研究者 / 研究機関 / 技術領域 / TRL / 関連 atlas_themes
   │     UI: /seeds 一覧・追加・編集
   │
   └─→ [新規] Venture Map（統合ビュー、デモ主役）
         Atlas × MacroIndex × Papers × Seeds × ventures(過去SU実績) を統合
         UI: /venture-map（3ビュー: A/B/C）+ /venture-map/su/[id]（SU個別ビュー）
```

---

## 2. View 仕様

### 2.1 View A: マクロトレンド時系列マップ（メイン）

```
横軸: 時間 (2010 → 2027)
左縦軸: マクロ指数 (0-1 正規化、領域別)
右縦軸: 論文数 (絶対値 or 領域内シェア%、領域別)

レイヤー:
  M-1 マクロ指数: 領域ごとに 1本の実線（5本、太め、領域色）
  D-1 論文数: 領域ごとに 1本の破線（5本、薄め、領域色）
  D-2 政策イベント: 縦線 + 上端ラベル
     例: パリ協定 / IRA / EU CBAM / GX法成立 / カーボンプライシング / FRB利上げ局面 / AMED認知症重点 …
  D-3 16社プロット: その時点の "そのSUの所属領域のマクロ指数" の高さに点を打つ
     色 = AMDのアウトカムタグ（離陸/燃え尽き/UE失敗 など）
  D-4 シーズ予兆: 現在ライン右の "次に来そうな指数の山" 上に点滅マーカー

乖離可視化:
  H-1 論文線がマクロ線より先行している領域 → 紫の塗りつぶし帯（"研究先行 = シーズ仕込み期"）
  D-5 マクロ線が論文線より先行している領域 → 橙の塗りつぶし帯（"政策先行 = 研究を集中せよ"）
```

### 2.2 View B: 現時点スナップショット ダッシュボード

```
5領域 × 5指標 のヒートマップ:

           マクロ指数  論文数  政策密度  投資密度  シーズ在庫  → 総合温度
GXエネ      ████░    ███░░  ████░    ███░░    ██░░░       高
GXサ循      █████    ████░  █████    ██░░░    ████░       最高 ← 立てるべき
素材        ██░░░    ████░  ██░░░    █░░░░    ██░░░       論文-政策乖離あり（仕込み期）
ライフ      ███░░    █████  ████░    ████░    ███░░       バランス良
ロボ        ███░░    ███░░  ███░░    ████░    █░░░░       シーズ不足

「今、どこに立てるべきか」の判定:
  - 総合温度 = 0.4·マクロ + 0.2·論文 + 0.2·政策 + 0.1·投資 + 0.1·シーズ
  - 上位領域を🔥で強調 + シーズ在庫から候補を3件ピックアップ表示
```

### 2.3 View C: モデル数式パネル

```
表示する数式（領域 i, 時刻 t）:

  マクロ指数_i,t
    = α_i · 政策密度_i,t + β_i · 公募予算_i,t
    + γ_i · 投資額_i,t   + δ_i · 政策言及数_i,t
    （重み α,β,γ,δ は領域ごとに異なり、LLMで定期再学習）

  事業化適温度_i,t
    = マクロ指数_i,t × シーズ成熟度_i × (1 - 競合密度_i,t)

  論文-政策乖離_i,t
    = Δ論文数_i,t - Δマクロ指数_i,t
        > 0 : 研究先行 → シーズ仕込み期
        < 0 : 政策先行 → 大学に研究集中要請

  設立タイミングシグナル_SU
    = Σ_(t≦設立日) 適温度_i,t / Σ_(t≦設立日) 1   ※設立時点の3年移動平均
        高いSU = 波の頂点で立てた = 離陸確率高
        低いSU = 波の前 or 後で立てた = 燃え尽き/出遅れ

領域別重みベクトル表（最新算出値）:
  GXエネ:    α=0.45  β=0.20  γ=0.15  δ=0.20
  GXサ循:    α=0.50  β=0.25  γ=0.10  δ=0.15
  素材:      α=0.30  β=0.20  γ=0.30  δ=0.20
  ライフ:    α=0.25  β=0.40  γ=0.15  δ=0.20  ← AMED予算重め
  ロボ:      α=0.30  β=0.25  γ=0.25  δ=0.20

  最終再学習: 2026-04-28 03:00 JST （24時間ごと自動再学習）
```

### 2.4 サブビュー: SU個別 (TRL/BRL/HRL × マクロ重ね合わせ)

`/venture-map/su/[id]` で、特定SUを開いたときに表示。

```
横軸: 時間（そのSUの設立 -1年 → 現在）
左縦軸: XRL (1-9)
右縦軸: 該当領域のマクロ指数 (0-1)

ライン:
  - TRL（実線・濃）
  - BRL（実線・中）
  - HRL（実線・薄、内閣府SIP第3期定義）
  - 該当領域のマクロ指数（破線・領域色）

判定:
  - TRL/BRL/HRL のうち最低値 = ボトルネック
  - 内閣府SIPの結論「TRLばっかり上げても破綻、HRLが一番大事」を画面上で実証
  - ティエム ズーム時に「TRLはシリーズBで5まで上がったが BRL/HRL が伴わなかった」を見せる
```

---

## 3. データモデル

### 3.1 既存活用
- `atlas_signals` / `atlas_themes` / `atlas_divergences`（マクロ指数の原データ）

### 3.2 新規テーブル

```sql
-- マクロ指数の時系列ログ（領域 × 時刻 × 指数値 + 内訳）
create table macro_index_log (
  id uuid primary key default gen_random_uuid(),
  lane text not null,
  observed_at date not null,
  index_value numeric not null,
  policy_density numeric,
  budget_amount numeric,
  investment_amount numeric,
  policy_mention_count numeric,
  raw_signal_count int,
  computed_at timestamptz default now()
);
create unique index on macro_index_log (lane, observed_at);

-- 領域別重みベクトル（時系列で更新される）
create table macro_lane_weights (
  id uuid primary key default gen_random_uuid(),
  lane text not null,
  alpha numeric not null,  -- 政策密度の重み
  beta numeric not null,   -- 公募予算の重み
  gamma numeric not null,  -- 投資額の重み
  delta numeric not null,  -- 政策言及数の重み
  computed_at timestamptz default now(),
  computed_by text,        -- 'llm-sonnet-4-7' / 'manual' 等
  source_data_window_days int  -- 学習に使ったデータの時間窓
);
create index on macro_lane_weights (lane, computed_at desc);

-- 論文数の時系列（領域 × 時刻 × カウント）
create table papers_log (
  id uuid primary key default gen_random_uuid(),
  lane text not null,
  observed_at date not null,
  paper_count int not null,
  source text not null,    -- 'openalex' / 'jstage' / 'lens' / 'elsevier'
  query_hash text,
  computed_at timestamptz default now()
);
create index on papers_log (lane, observed_at);

-- 過去・現在SU実績（v1 から継承、軌跡概念は廃止）
create table ventures (
  id text primary key,
  display_name text not null,
  short_label text,
  lane text not null,
  founded_at date not null,
  status text not null,         -- 'active' | 'exited' | 'terminated' | 'pre_founding'
  outcome_pattern text not null, -- 'rocket' | 'lifted' | 'deep_pivot' | 'burnout' | 'ue_fail'
  origin_org text,
  origin_pi text,
  amd_role text,
  short_description text,
  is_public boolean default true,
  created_at timestamptz default now()
);

-- SU個別ビュー用の XRL ログ
create table ventures_xrl_log (
  id uuid primary key default gen_random_uuid(),
  venture_id text references ventures(id) on delete cascade,
  observed_at date not null,
  trl int,
  brl int,
  hrl int,
  grl int,                 -- 将来拡張
  srl int,                 -- 将来拡張
  bottleneck text,         -- 'TRL' | 'BRL' | 'HRL' | ...
  milestone_label text,
  source_note text
);
create index on ventures_xrl_log (venture_id, observed_at);

-- 研究シーズ在庫
create table seeds (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  origin_org text,
  origin_pi text,
  lane text,                       -- atlas のレーン語彙と一致
  trl int,
  brl int,
  hrl int,
  status text not null,            -- 'candidate' | 'reviewing' | 'venture_created' | 'rejected' | 'on_hold'
  linked_atlas_theme_ids uuid[],
  linked_venture_id text references ventures(id),
  is_public boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 3.3 cron 設計（実装は後フェーズ）

| 名前 | スケジュール | 内容 |
|---|---|---|
| `compute-macro-index` | 毎日 04:00 JST | atlas_signals/themes 集計 → macro_index_log 更新 |
| `relearn-lane-weights` | 毎日 03:00 JST | LLM (Sonnet 4.7) に直近データを食わせて重みベクトル再算出 → macro_lane_weights に新行 |
| `fetch-papers` | 週1回 (月 02:00 JST) | OpenAlex/J-STAGE 等から論文数取得 → papers_log |

---

## 4. 実装マイルストーン（5/20まで）

| Phase | 内容 | 期日目安 |
|---|---|---|
| **Phase 0**（即着手） | 新3ビューUIモック（ハードコード） + デプロイ → まさ認識合わせ | 5/3 |
| **Phase 1** | DDL適用（5テーブル） + 9社の初期シード値投入 | 5/5 |
| **Phase 2** | View A をハードコードからDB読みに置換、View C の重み表もDB読みに | 5/8 |
| **Phase 3** | View B のスナップショットをDB集計で計算 | 5/10 |
| **Phase 4** | OpenAlex から論文数取得 cron 実装、papers_log を埋める | 5/13 |
| **Phase 5** | macro_index_log を atlas_signals 集計から自動算出する cron | 5/15 |
| **Phase 6** | LLM 重み再学習 cron 実装、View C の "最終再学習" を実値で動かす | 5/17 |
| **Phase 7** | SU個別ビュー (TRL/BRL/HRL × マクロ重ね) 実装、ティエム/JCに実値投入 | 5/18 |
| **Phase 8** | デモ用パブリックURL + リハシナリオ確認 + 当日朝までポリッシュ | 5/19-20 |

**最低限のデモ要件**: Phase 0-2 が動けば、ハードコード重み + 一部DB読みの組合せでデモは成立する。Phase 4以降は「作ってる途中の壮大さ」を見せる素材として価値あり。

---

## 5. 領域 × Atlas テーマ マッピング

atlas_themes 54本を5レーンに振り分ける必要がある。実装時に Atlas Admin から拾う。
（atlas_themes の選定改善は別バックログ）

仮マッピング:
- gx_energy ← 「再生可能エネルギー」「水素」「カーボンキャプチャ」「DC冷却」「核融合」...
- gx_circular ← 「循環経済」「廃棄物」「リサイクル」「カーボンプライシング」「水処理」...
- materials ← 「ナノマテリアル」「機能性材料」「半導体」「光電変換」...
- life ← 「創薬」「バイオ」「医療機器」「再生医療」「精神疾患」...
- robo ← 「ロボティクス」「農業DX」「自動運転」「ドローン」...

---

## 6. 9社マッピング（変更なし）

| 社略 | 正式 | レーン | outcome_pattern | メモ |
|---|---|---|---|---|
| ティエム | ティエムファクトリ | materials | burnout | 京大、2012-2022、まさ退任 |
| BWE | Blue Water Energy | gx_energy | lifted | スタジオモデル第1号、長崎西部下水大型PoC |
| JC | JOYCLE | gx_circular | deep_pivot | 群大野田先生流動層熱分解で後付けdeep化 |
| CTB | CrestecBio | life | rocket | 虚血性脳卒中薬 CTB211 / AMED採択 |
| LST | LisTie | gx_circular | rocket | リチウム回収 |
| KT | 輝翠TECH | robo | lifted | 農業ロボ / オンサイトPoC完了 |
| CX | CryoX | gx_energy | rocket | NIMS神谷 / 磁気冷凍DC冷却 |
| SX | SolvioraX | gx_circular | rocket | 愛媛大杉浦 / シアノ排水処理 |
| YD | Yellow Duck | gx_energy | ue_fail | 波力発電 / UE不成立で終了 |

地図に乗せない: SE, ORB, r3kt, OQC, aerota, autoklip, KR, OkuDoor, ZMP, MC, OPT。

---

## 7. 内閣府SIP XRL 定義（参照）

第3期SIP（2023-2027）から導入された **5本の Readiness Level**:

- **TRL** (Technology Readiness Level) — 1-9、技術成熟度
- **BRL** (Business Readiness Level) — 1-9、事業準備度
- **GRL** (Governance Readiness Level) — 1-9、ガバナンス準備度
- **SRL** (Society Readiness Level) — 1-9、社会受容度
- **HRL** (Human Resource Readiness Level) — 1-9、人材準備度

**SIP最終結論**: 「TRLばっかり上げてないで他のXRLも上げないと破綻する。HRLは一番大事かも」（BWEを創出したプログラム）

**実装上**: まずは TRL/BRL/HRL の3本を扱う。GRL/SRL は将来拡張の口を残す。

参照:
- [次期SIP検討状況 R4年9月（内閣府）](https://www8.cao.go.jp/cstp/gaiyo/sip/taskforce/smartbousai_3/siryo5.pdf)
- [5つの視点でのロードマップと成熟度レベル（内閣府SIP第3期）](https://www8.cao.go.jp/cstp/gaiyo/sip/sip_3/keikaku/14_material_2.pdf)
- [XRL解説（第一生命経済研究所）](https://www.dlri.co.jp/report/ld/336714.html)

---

## 8. 当日運用

- **公開可否**: `is_public=true` のものだけデモ表示
- **失敗時のフォールバック**: 事前録画スクリーンキャストを用意
- **ネットワーク**: ローカル `next dev` でも動く状態
- **触らせない**: デモ中は壇上のオペレーション専用

---

## 9. 非公開・取扱注意

- CX のプランB 技術詳細・特許出願準備中の中身 → 触れない
- SX のバイオ燃料応用 → 触れない、表示は「カーボンクレジット」止まり
- ティエム退任時の機微情報には触れない
- BWE は「卒業」と表現しない（経営陣として継続関与中）

---

## 10. 関連リンク

- スタパイベント詳細: `/Users/masa/projects/AMD/stapa/HANDOFF_event_if25.md`
- AMD全社観: `/Users/masa/projects/knowledge/overview.md`
- AMD価値モデル: `/Users/masa/projects/knowledge/amd_value_model.md`
- AMD OS Vision: `/Users/masa/projects/knowledge/amd_os_vision.md`
- CX overview: `/Users/masa/projects/AMD/CX/overview.md`
- SX overview: `/Users/masa/projects/AMD/SX/overview.md`
- Atlas 基盤: `/Users/masa/projects/AMD/amd-os/pwa/atlas.md`
- Atlas 政策収集: `/Users/masa/projects/AMD/amd-os/pwa/policy_signals.md`
