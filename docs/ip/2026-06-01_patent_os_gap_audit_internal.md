# AMD OS / AMDプロトコル 特許案 現OS乖離チェック（内部版）

- 作成日: 2026-06-01
- 位置づけ: 特許出願準備用の内部audit。外部送付用ではない。
- 作業範囲: repo内資料・実装・schema dump・migration・PWA画面コードのread-only確認。DB write / production DB接続 / 外部送付は未実施。
- 注意: 実PJ本文、production DB row、実source所在、prompt全文、few-shot、score parameter詳細は記載しない。

## 0. 結論

特許案の中核である **5生データ -> L2候補 -> 証拠メタデータ -> 通知/人間承認 -> 正本反映 -> feedback学習** と、**AMDプロトコルの普遍化 + 1:N事例 + append-only outcome ledger** は、現OSに実装・設計の裏付けがある。

一方で、明細書たたき台が強く書いている次の要素は、現OSでは「設計済み / tableあり / 部分実装」止まり、または未発見だった。

- WS-1: 「全文非保存」は設計原則として強いが、`source_cache.content_text` など実装上は短文キャッシュの扱いを明細書表現で抽象化する必要がある。
- WS-3/WS-4: outcome ledger tableはあるが、結果観測の確認UI・矛盾観測UI・複数異種evidence参照中間テーブルは薄い。
- WS-5: `amd_score_revisions` / `amd_score_alpha_proposals` はschemaまであるが、汎用system parameter governanceとしては未実装。現状はAMD Score寄り。
- WS-6: Before-Zero / 法人設立時期推奨は理論・運用・IP案の裏付けはあるが、専用table / route / UIは未発見。
- Fig.8相当の「統合確認UI」は、`/notifications`, `/admin/protocols`, `/admin/ip`, cockpit等に分散しており、単一画面としては未実装。

したがって、現OSとの差分は「出願不能」ではなく、**明細書では抽象実施例として書き、現OS側はretrofitで薄い箇所を補う**のがよい。

## 1. WS別 現OS裏付け表

| WS | patent element | claim / draft location | OS implementation evidence | design/doc evidence | status | gap | recommended action |
|---|---|---|---|---|---|---|---|
| WS-1 | 複数業務データ源から候補生成し、source refs / snippet / hash / extraction_run_id / confidence等の証拠メタデータを付与。全文非保存を原則にする | 請求項1-3、明細書2-4、14.1-14.2 | `project_strategy_signals.source_refs_json/source_hash/confidence/extraction_run_id`, `project_xrl_evidence.source_refs_json/source_hash/confidence`, `l2_notifications.metadata_json`, `source_cache` | `pwa/spec/3-1-l2-data-extraction-current-spec.md`, `pwa/design/L2_DATA.md`, `pwa/design/project_strategy_signals.md`, `pwa/design/xrl_evidence.md`, `pwa/design/db_schema.md` | implemented / partial | `source_cache.content_text` があり、実装全体として「全文を一切保存しない」とは断定しにくい。実source所在も抽象表現に留める必要がある | 主請求項では「正本DBへ全文を保存しない」「所定長以下の抜粋又はメタデータ」と表現。retrofitはsource refs正規化と保存上限の明文化 |
| WS-2 | 候補を確認UIに出し、承認/却下/コメントで正本反映を制御。コメントを後続抽出へ戻す | 請求項1, 3-5, 14、明細書5-7、14.3-14.4 | `/notifications`, `POST /api/notifications/feedback`, `l2_feedbacks`, yes/no/comment handlers, `protocols.status`, `project_strategy_signals.status`, `project_xrl_evidence.status` | `pwa/design/notifications.md`, `pwa/spec/3-1-l2-data-extraction-current-spec.md`, `pwa/design/amd_protocol.md` | implemented | `ms_progress` は通知ではなく月次モーダルrevision confirm。L2ごとに承認UIが分散している | 明細書では「確認インターフェース又は関連画面群」と書く。claim 14は「少なくとも一部を表示」に留める |
| WS-2 | reject/comment feedbackを後続抽出条件、prompt、判定ルール、設定値へ反映 | 請求項5、明細書7、14.4 | `l2_feedbacks.applied_count/last_applied_at`, feedback API、GAS/automation後継設計でfeedback blockを抽出時参照 | `pwa/design/notifications.md`, `pwa/design/amd_protocol.md`, `pwa/spec/3-1-l2-data-extraction-current-spec.md` | implemented / designed | 現writerの一部はMMO/Codex automation側で、repo内コードだけでは全実行履歴を確認できない。具体変換ロジックは営業秘密扱い | 明細書は「feedback dataを後続処理で参照可能にする」と抽象化。prompt注入に限定しすぎない |
| WS-3 | 承認済み判断を固有名詞除去/抽象化し、普遍protocolとして保存 | 請求項6、明細書8、14.5 | `protocols`, `protocol_examples`, `/admin/protocols`, `AdminProtocolsClient` | `pwa/design/amd_protocol.md`, migration `049_protocol_examples.sql` | implemented | 自動抽出writerはMMO automation。repo内では現行automationの実行結果までは未確認 | 実装裏付けあり。主請求項に入れる場合は狭さを弁理士確認 |
| WS-4 | 1 protocol : N project examples構造 | 請求項7、明細書9、13 | `protocol_examples` schema、`/admin/protocols` がexamplesをprotocol_id単位で集約表示 | `pwa/design/amd_protocol.md`, `pwa/design/db_schema.md` | implemented | `source_meeting_id` は狭い。claimでは「source evidence identifier」へ広げるべき | 主請求項・従属項では実装名を出さず、抽象識別子として書く |
| WS-4 | multi-horizon outcome ledgerをappend-only保存し、矛盾観測を保持 | 請求項8-10、明細書10、14.6 | `protocol_result_observations` table / migration 070。schemaはhorizon, valence, confidence, summary, evidence fieldsを持つ | `pwa/design/amd_protocol.md`, `pwa/design/db_schema.md` | partial | `/admin/protocols` server pageは`protocol_result_observations`を読んでいない。矛盾観測UIは未発見。複数evidence中間テーブルは未実装 | retrofit high。まずoutcome read/write UI、矛盾観測表示、中間evidence ref table又はJSON設計を補う |
| WS-5 | score/prompt/rule/config/model/workflow等のsystem parameter変更候補をpending proposal化し、承認時のみversion保存 | 請求項11-12、明細書11、14.7 | `amd_score_revisions`, `amd_score_alpha_proposals` schema / migration 090 | `pwa/design/score_revision_feedback_loop.md`, `pwa/spec/4-2-amd-score-current-spec.md`, `pwa/design/db_schema.md` | designed / partial | score-specific schemaはあるが、`system_parameter`, `parameter_proposal`, `parameter_version` の汎用tableや統一UIは未発見。`/admin/amd-score-alpha-review` 画面も未発見 | retrofit high。明細書は「system parameter」抽象で書き、現OS retrofitはscore-specificから汎用governanceへ拡張 |
| WS-5 | 変更理由を集約してmodel / rule更新候補を作る | 旧提案書要素4、請求項11-12 | `amd_score_revisions.reason_md`, `amd_score_alpha_proposals.pattern_summary_md/proposed_alpha_diff/reasoning_md` | `pwa/design/score_revision_feedback_loop.md`, migration 090 comments | designed | tableはあるがcron / UI / approved version反映の実装は薄い | 出願では実施例の一態様に留める。実装retrofitは週次review jobとapprove/reject UI |
| WS-6 | Before-Zero研究シーズについて、設立時期推奨データを生成 | 請求項13、明細書12、14.8、Fig.7 | 現OSには`project_ventures.founded_at`, `project_founding_members`, `amd_score_inputs`, BZM/AMD Score画面等の周辺根拠あり。専用推奨table/routeは未発見 | `docs/ip/*`, `pwa/design/amd_score.md`, `pwa/design/L2_DATA.md`, BZM chapters | designed / operated-manually / not-found | `incorporation_timing_recommendation` table、推奨生成route、通知UIは未実装。設立時期判断は運用・理論に近い | retrofit high。claimは従属・補強に留め、実装は抽象カテゴリ入力 + recommendation table + review UIを追加 |
| Cross | 統合確認UIが候補/evidence/review/protocol/outcome/proposalを横断表示 | 請求項14、明細書5、Fig.8 | `/notifications` が候補/evidence/review、`/admin/protocols` がprotocol/example、`/admin/ip` がIP report、cockpitがsignalsを表示 | `pwa/design/notifications.md`, `pwa/design/amd_protocol.md`, `pwa/src/app/(app)/admin/ip/ip-report.ts` | partial | 単一の統合確認画面としては未実装。outcome/proposal表示も薄い | claimは「同一画面又は関連画面群」「少なくとも一部」と書く。retrofit medium-high |

## 2. 請求項1〜16のうち現OS実態との乖離があるもの

| Claim | gap summary | current OS assessment | recommended handling |
|---|---|---|---|
| 1 | 主請求項が「全文非保存」「feedback反映」「protocol生成」まで一体化。現OSはL2種別ごとに分散し、一部source cacheに短文テキストあり | partial / implemented | 「正本DBへ全文を保存しない」「所定長以下」「関連画面群」と抽象化。protocol生成を主請求項に入れる狭さは弁理士確認 |
| 2 | データ源列挙はOS設計と整合。ただし各L2が常に5種すべてを読めているとは限らない | implemented / designed | 「少なくとも二以上」に維持。5生データ全対応は明細書の実施例として書く |
| 3 | evidence metadataの永続化は複数テーブルで実装。ただし共通`evidence_metadata` tableではない | implemented / partial | 「候補データに関連付けて保存」または「1以上のテーブルに保存」と広く書く |
| 4 | approved-only reflectionは通知/一部UIで強い。MS進捗など別confirm経路あり | implemented | 「確認インターフェース」は単一画面に限定しない |
| 5 | feedback反映は設計・一部実装あり。具体prompt変換は非開示でよいが、全L2で同じ成熟度ではない | partial / designed | 「後続処理で参照可能」「抽出条件/判定ルール等へ反映」に寄せる |
| 6 | protocol抽象化は現OSの強い実装根拠あり | implemented | 現状通り。ただし固有名詞除去の具体promptは書かない |
| 7 | 1:N事例構造は実装済み | implemented | `source_meeting_id`等の実装名は実施例側へ落とす |
| 8 | outcome ledger tableはあるが、保存運用・UIは薄い | partial | retrofit high。明細書はappend-only table実施例として可、現OS実装は補強必要 |
| 9 | 矛盾観測UIは設計記載あり、実UI未発見 | partial / not-found | claimに残すならUI retrofitが必要 |
| 10 | 複数異種evidence参照はstrategy/xrl等ではあるが、outcome専用の複数参照構造は薄い | partial | `evidence_refs` JSON又は中間テーブルをretrofit。明細書では抽象参照にする |
| 11 | score revision proposal tableはあるが、prompt/rule/config/model/workflow横断の汎用parameter governanceは未実装 | designed / partial | 分割候補または従属項。score parameter詳細は書かない |
| 12 | 複数種類parameterへの同一処理パターン統一適用は未発見 | not-found / designed | retrofit high。現OS実態としては「score modelで先行実装」に留める |
| 13 | Before-Zero設立時期推奨は運用・理論の裏付けはあるが、専用機能は未実装 | designed / operated-manually / not-found | 従属項・補強扱い。retrofit high |
| 14 | 統合確認UIは分散実装。候補/evidence/reviewは強いがoutcome/proposal横断表示は薄い | partial | 「少なくとも一部」「関連画面群」を維持。retrofit medium-high |
| 15 | 装置クレームはPWA/Supabase/automationで一般的に支えられる | implemented | 形式は弁理士整備 |
| 16 | プログラムクレームはPWA/API/automationで一般的に支えられる | implemented | 形式は弁理士整備 |

## 3. 明細書に書いてよい抽象表現 / 実装詳細を出さずに済ませる表現案

| topic | 書いてよい抽象表現 | 出さない実装詳細 |
|---|---|---|
| source evidence | 「ソース種別、ソース識別子、日付、タイトル、所定長以下の抜粋、ハッシュ値、抽出処理識別子、信頼度の少なくとも一部」 | 実source所在、production DB row、長いsnippet、connector認証、watch path |
| no-full-text | 「正本データベースには元データ全文を保存せず、必要最小限の証拠メタデータ又は短い抜粋を保存する」 | 実際の元メール/議事録/Slack本文、保存上限の運用値 |
| feedback | 「却下又はコメントに基づくfeedback dataを、後続の抽出条件、判定ルール、設定値、又はワークフロー定義へ反映する」 | prompt全文、few-shot、comment-to-guidance変換ロジック |
| protocol identity | 「ハッシュ、類似度判定、クラスタ、手動タグ、UUID等により同一又は類似の意思決定パターンを識別する」 | 実hash桁数、実title、実PJ名、人名 |
| protocol example | 「プロジェクト固有事例は、対象プロジェクト識別子、発生日、要約、出典証拠識別子を含む」 | `source_meeting_id` 固定、実meeting id、実source所在 |
| outcome | 「複数評価期間カテゴリ、評価極性カテゴリ、信頼度、要約、証拠参照を含む結果観測データをappend-onlyに保存する」 | 実PJ結果本文、実KPI raw row、実source所在 |
| parameter governance | 「prompt、rule、config、model、workflow等のsystem parameterに対し、pending proposal、review、approved versionを管理する」 | score parameter詳細、実model設定値 |
| Before-Zero | 「法人設立前研究シーズについて、承認済み正本レコード及び結果観測カテゴリに基づき、設立時期推奨カテゴリを生成する」 | 実PJ事例本文、設立判断の具体重み、まさの判断ノウハウの生ログ |
| UI | 「確認インターフェース又は関連画面群が、候補、証拠、review状態、protocol、outcome、proposalの少なくとも一部を表示する」 | 現OSの画面URLを外部向けに細かく書くこと、admin-only運用導線 |

## 4. Retrofit必要度

### high

| area | reason | suggested retrofit |
|---|---|---|
| WS-3/4 outcome UI + contradictory observation | tableはあるが、結果観測の入力/表示/矛盾併記が未発見 | `/admin/protocols` に `protocol_result_observations` read/write、horizon/valence別表示、矛盾chipを追加 |
| WS-4 outcome evidence refs | 現tableは単一evidence fields中心。請求項10の複数異種evidence参照には薄い | `protocol_result_observation_evidence_refs` 又は `evidence_refs_json` を追加し、source category / role / short basisを保存 |
| WS-5 generic system parameter governance | score-specific tablesはあるが汎用parameter table/UIが未発見 | `system_parameters`, `parameter_proposals`, `parameter_versions` の抽象schema、admin review UI、approved-only version昇格 |
| WS-6 incorporation timing recommendation | 専用table/route/UI未発見 | `incorporation_timing_recommendations`、入力カテゴリ、missing/conflicting categories、review notificationを追加 |

### medium

| area | reason | suggested retrofit |
|---|---|---|
| WS-1 no-full-text guard | 設計原則は強いが、source cache系の保存実態と表現の整合が必要 | source refs保存上限・正本DB非保存・短い抜粋ポリシーをspec化 |
| WS-2 feedback application audit | feedback tableはあるが、どの抽出で参照されたかの横断可視性が薄い | `applied_count`だけでなくrun id / l2 kind / candidate type別の参照ログを抽象的に残す |
| Claim 14 integrated confirmation UI | 現状は分散画面 | `/admin/ip` か `/notifications` にIP audit用 summary viewを追加。ただし出願前は内部限定 |

### low

| area | reason | suggested retrofit |
|---|---|---|
| WS-2 approval gate | notifications/API/status transitionがすでに強い | L2ごとのyes/no動作表をspecに維持 |
| WS-3 protocol abstraction | protocols + examples + admin UIあり | source evidence identifier表現へ広げるだけ |
| Claim 15/16 | 装置/プログラム形式は実体サポートあり | 弁理士側で形式整備 |

## 5. まさ判断事項（5個以内）

1. **主請求項にprotocol生成まで入れるか**

   現OSには裏付けがあるが、HITL抽出ツールとの差別化が強くなる代わりに請求項は狭くなる。

2. **WS-5 system parameter governanceを基幹出願に残すか、分割候補にするか**

   現OSはscore-specificのtableまで。汎用化retrofit前に強く書くと現実装との差分が大きい。

3. **WS-6 Before-Zero設立時期推奨をどこまで出すか**

   ビジネス上は強いが、現OS実装は薄い。従属項・補強に留めるか、retrofitを先に入れるか判断が必要。

4. **outcome ledgerのretrofitを出願前に最小実装するか**

   tableはあるので、UI + 複数evidence refsを足すだけでも請求項8-10の現OS裏付けがかなり強くなる。

5. **弁理士へ渡す版でadmin/ip narrativeをどこまで削るか**

   現adminレポートは読み物として強いが、出願書類・相談資料では営業秘密、実PJ名、実運用ニュアンスをさらに削るべき。

## 6. 禁止情報チェック

- production DB row: 記載なし。
- 実source所在: 記載なし。
- prompt全文 / few-shot / comment変換ロジック: 記載なし。
- score parameter詳細: 記載なし。
- 実PJ本文 / 個別判断本文: 記載なし。
- DB write / production接続: 未実施。
