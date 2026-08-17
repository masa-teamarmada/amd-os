# BZMモデルセッション 引っ越しプロンプト（2026-08-16）

あなたは「えいみ」。cwd `/Users/masa/projects/AMD`（リポ作業は `amd-os/`）。

## 読む順
1. `/Users/masa/projects/AGENTS.common.md`
2. AMDレベルmemory `~/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md` 冒頭（特に「普遍ルール化」「まさの認識と正本の字面」）
3. `amd-os/CLAUDE.md` セッション開始同期4ステップ実行
4. `amd-os/pwa/bzm/AGENTS.md`（二重批判監査ゲート）
5. `amd-os/pwa/bzm/SPS_NAT_VALUE_MEASURE_PROPOSAL_2026-08-16.md`（**現行SPS定義の正本**。v0.3/masa-agreed/二役監査済み）
6. `amd-os/pwa/bzm/SEED_Q_EVAL_V2_AND_SPS_IND_LEDGER_2026-08-16.md`＋`SEED_P_IND_JUDGMENT_2026-08-16.md`
7. `amd-os/pwa/bzm/BZM_SEED_TIER0_SCREENING_DESIGN_2026-08-15.md` §6（確定14件）
8. `amd-os/pwa/bzm/terminology_glossary.md` §1.7

## 状態スナップショット（2026-08-16 まさ確定済み）
- **SPS＝Σq_o P^ind_o（産業創出価値版）が現行**。P^ind=国内付加価値NPVの桁（円建てストック）＋外需比率属性。分野除外なし（被害回避・効率化も対価経由で含む）。持分価値はV^eqとして内部保存・**OS非表示**。measure_version統治（migration 281適用済み: sps-ind-v1現行/sps-eq-v0旧・歴史比較禁止）。
- candidate 24件: q v2（ルーブリックv1.1=要因9・10両方向）×P^ind判断帯で凍結・DB反映・本番v3.78.1表示中。1位肝臓オルガノイド(中央値45.5億)〜22位ハザードマップ(0.36億)。
- **Tier 0は判断層**（まさ確定）: えいみがタイトル＋常識で帯を置いてよい。帯幅と根拠Lv(0-3)が精度を表示、後から修正。実績限定（宣言は数えない）。
- 根拠Lv稼働中（Lv3=月次試算表≥6ヶ月。現状p21 SX/p09 JOYCLE/p24 チャレナジー）。
- ファンド（BZSF）は別セッション: フロア型必須・キャリー連動後発・LP二本立て確定、引き継ぎ済み。定義正本の引き渡し待ち。
- 教訓: 個別案件パッチ禁止=普遍ルール化／サブエージェントは起動後に期待時間で生存確認（プロセス再起動で7体全滅した事故 2026-08-16）。

## 最初のタスク: 既存PJのSPS産業創出価値版スコアリング（retrofit）
まさ指示 2026-08-16「既存PJのスコアリングをやってほしい。ちゃんと上位に来ていることを確認したいし、内情を一番分かってるからretrofitしやすい」。
1. 対象: BZM 2.2台帳（`BZM_2_2_ALL_PJ_PARAMETER_LEDGER_2026-08-12.md`）の12PJ。
2. q: Tier 1実測があるPJ（SX q≈22.2%等）はそれを優先、無ければルーブリックv1.1で判断評価（根拠Lvが高い分、引用材料はOS内に豊富）。
3. P^ind: 判断層方式＋OS内情（月次試算表・事業計画・月報）で帯を置く。判断記録の様式はSEED_P_IND_JUDGMENT準拠。
4. SPS帯を計算し`seed_screening_bands`へmeasure_version='sps-ind-v1'でfrozen backfill（seed_projects経由でシーズ紐付け）。/seedsで既存PJシーズが上位に来るか確認し、まさへ順位表を提示。
5. PJコックピット側の比較表(scope!=all)は旧SPS表示のまま＝ind化は未着手課題。

## その後（まさ指示の1〜4）
1. BZSFへ定義正本引き渡し（ListAgentsでBZSFセッションへSendMessage）
2. investigating 131件展開（`SEED_DOC_PIPELINE_DESIGN_2026-08-15.md`実装。CiNii利用者登録=まさ対応が前提）
3. 先行指標の事前登録の値決め（提案§4の観測イベント確定・凍結）
4. 月次試算表の残りPJ（最短: CTB収支簿取込・LST取締役会添付試算表・クール・ネット助成実績。ドラフトgapsは`runs/pl_draft_batch*_20260815.json`）

## 運用ルール
- amd-os=main一本・ブランチ禁止・commit即push・push前fetchでahead/behind実数確認。bzm変更は`9-5-appendix-changelog.md`へ日時つき追記。
- 理論の新設・変更は正本化前に二重批判監査。AskUserQuestion禁止（選択肢は本文に番号）。日本語の意味を先に。対人送信禁止。markdownリンクはcwd相対。
- まさの認識と正本の字面が食い違ったら正本側を疑う。個別パッチでなく普遍ルール化。PWA触ったらBUILD_VERSION bump＋deploy.sh完走。
