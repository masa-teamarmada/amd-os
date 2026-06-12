# Public Manuscript Audit

> Date: 2026-06-01 JST
>
> Scope: `pwa/bzm/*.md` as current Textbook manuscript source.
>
> Output labels: `public_keep`, `public_rewrite`, `internal_only`, `case_seed`.

## Executive Summary

現行 `pwa/bzm/*.md` は、公開本の素材としては強いが、販売原稿そのものではない。

主な判定:

- `public_keep`: 数式、rubric、記号表、学術文献、概念定義の一部。全章そのまま公開できるファイルはほぼない。
- `public_rewrite`: 0-1〜7-1 と 9-1〜9-4 の大半。価値は高いが、AMD/まさ/正本/OS実装を読者主語へ置換する必要がある。
- `internal_only`: `8-1`、`8-2`〜`8-5` の L2/applier 受け皿記述、`9-5`、`COMMANDER_TASKS.md`、内部参考文献/path/changelog。
- `case_seed`: `1-3`、`1-4`、`6-1` の現場シーンとretrofit素材。匿名化・一般化すれば公開ケースになる。

公開原稿の基本方針:

- 会社主語を消し、読者である産連担当者、URA、研究者、若い事業化人材を主語にする。
- `AMD Score` は公開用の名前を決めるまでは仮に `Before Zero Readiness Score` として扱う。
- `AMD の提供価値`、`AMD OS 実装`、`D-7 Textbook Insights candidate/local applier` は本文から外し、内部制作メモに退避する。
- スタパ素材は「ある研究支援の場面」「GAPファンドとVC評価の間で起きる矛盾」のような一般化シーンへ変換する。

## File Classification

| Source | Overall | Detail | Public action |
|---|---|---|---|
| `pwa/bzm/0-1-preface.md` | `public_rewrite` | lines 15-24 の問いは公開向けに使える。lines 7-13, 25-38, 53-86 は AMD/AMD OS/D-7 Textbook Insights/正本を含むため全面編集。line 96 は内部pathなので `internal_only`。 | 序章は「本書は誰の何を楽にするか」から書き直す。AMD利用者向け読者定義は削除。 |
| `pwa/bzm/1-1-why-before-zero.md` | `public_rewrite` | lines 15-67 の Valuation 限界と四原則は強い。lines 9, 71, 89 の AMD 主語・実務根拠は置換。 | 「支援現場では Before Zero が見落とされる」へ主語変更。出典は field experience note へ。 |
| `pwa/bzm/1-2-before-zero-field-landscape.md` | `public_rewrite` | lines 5-33 は公開向き。line 3, line 36 以降の AMD 観察主語を修正。 | 「伴走者/支援チームは何を見るか」に置換。 |
| `pwa/bzm/1-3-field-frictions-and-patterns.md` | `case_seed` | patterns A-D は `public_rewrite`。lines 54-64 はスタパ由来の強い `case_seed`。lines 66-76 は AMD変換語が強く `public_rewrite`。 | イベント名を消し、研究者の孤独、局所最適、CEO機能分解の匿名ケースへ。 |
| `pwa/bzm/1-4-gates-and-judgment-branches.md` | `case_seed` | lines 19-77 は公開ケース化できる。lines 35-41, 68-75 の AMD 主語を置換。lines 79-92 の D-7 Textbook Insightsログ運用は `internal_only`。 | GAP/VC/CEO論の矛盾を公開章の中心ケースへ。分岐ログは読者用 checklist へ変換。 |
| `pwa/bzm/1-5-relationships-and-learning.md` | `public_rewrite` | lines 5-31, 45-60 は公開向き。lines 33-43 の AMD/D-7 Textbook Insights 学習ループは `internal_only` または制作メモ。 | 失敗学習を「支援者の観察メモを再利用可能な問いにする」へ書き換え。 |
| `pwa/bzm/1-6-field-elements-to-bzm-variables.md` | `public_rewrite` | lines 5-18, 37-80 は公開向き。lines 22-35 の表は AMD列と `frl_cap_amd` を公開名へ変換。line 65 の AMD役割は支援機能へ一般化。 | 公開本の橋渡し章として重要。変数名より先に現場語を置く。 |
| `pwa/bzm/2-1-sigma-su-triple-helix.md` | `public_rewrite` | lines 17-164 の理論説明・例題は概ね利用可。lines 9-12 のまさ引用、line 27 のアルマダロゴは内部/著者側が強い。 | まさ引用を「現場で繰り返し確認される命題」に置換。ロゴ言及は削除。 |
| `pwa/bzm/2-2-state-space-model.md` | `public_rewrite` | 理論本文と例題は価値が高い。理論正本参照や内部推定パイプライン参照は公開本文から外す。 | 数式章として残すが、読者向けに「なぜこの複雑さが現場判断に効くか」を冒頭に追加。 |
| `pwa/bzm/3-1-xrl-group.md` | `public_rewrite` | TRL/BRL/GRL/SRL/HRL 定義は公開利用可。Shallow Tech/AMDスタジオ対象の記述は一般化。 | 支援者が使う成熟度チェックとして再構成。 |
| `pwa/bzm/4-1-frl-founder-readiness.md` | `public_rewrite` | FRL二層構造、ALQ/Grit/Resilience、CES は公開価値が高い。まさ引用、AMD補完、AMD提供価値定量化は公開本文では過剰。 | 「創業者機能は本人資質と補完可能な経営実務に分ける」へ読者主語で再構成。 |
| `pwa/bzm/5-1-amd-score-integration.md` | `public_rewrite` | Cobb-Douglas、shift、bottleneck は公開利用可。AMD Score 名、AMD action、UI/実装バグは公開向けに変更または退避。 | `Before Zero Readiness Score` 仮称にし、実装バグは内部注釈へ移す。 |
| `pwa/bzm/6-1-retrofit-verification.md` | `case_seed` | retrofit 方法論は公開向き。ティエム/9PJ は匿名化すれば強いケース。まさ主観、AMD PJ名、内部正本参照は公開不可。 | 「断熱材系素材の会社化が早すぎたケース」など匿名ケースへ変換。 |
| `pwa/bzm/7-1-ers-ecosystem-readiness.md` | `public_rewrite` | ERS、8軸、二重計上回避は公開価値が高い。AMD Score/AMD OS/UI/path/正本は置換。 | 産連/URAが自機関を点検できる章にする。 |
| `pwa/bzm/8-1-amd-os-operations.md` | `internal_only` | AMD OS実装、L2抽出、UI、スライダー、Shallow Techモード、実践章routingは内部運用色が強い。 | 公開本には入れない。必要な理論まとめだけ 5章/7章へ吸収。 |
| `pwa/bzm/8-2-field-decisions-and-branches.md` | `internal_only` | D-7 Textbook Insights candidate/local applier 受け皿。掲載基準の考え方だけは将来 checklist seed。 | 公開版では「判断分岐チェックリスト」として新規書き直し。 |
| `pwa/bzm/8-3-failures-pivots-and-revisions.md` | `internal_only` | D-7 Textbook Insights追記フォーマット中心。失敗学習の掲載基準は公開素材化可能。 | 「失敗を責任論ではなく仮説更新で読む」章へ再編集。 |
| `pwa/bzm/8-4-relationship-playbook.md` | `internal_only` | D-7 Textbook Insights追記フォーマット中心。相手別論点は公開プレイブック seed。 | 研究者/大学/企業/VC/行政ごとの合意順序として書き直し。 |
| `pwa/bzm/8-5-before-zero-checkpoints.md` | `internal_only` | L2/candidate/applier/OS側PJタスクが出る。問いテンプレは公開 seed。 | 公開版では「各フェーズの赤信号と問い」に再構成。 |
| `pwa/bzm/9-1-references.md` | `public_rewrite` | A/B は `public_keep`。C/D は内部正本・AMD OS・PJ名が出るため `internal_only`。 | 公開参考文献は学術/政府資料中心にし、内部資料は削除または著者注へ。 |
| `pwa/bzm/9-2-notation.md` | `public_keep` | 数学記号表として最も公開利用しやすい。`AMD Score` の公開名だけ要調整。 | 公開用名称に合わせて軽編集。 |
| `pwa/bzm/9-3-glossary.md` | `public_rewrite` | 用語集として使えるが AMD独自、正本、path が混ざる。 | 公開用語だけに絞り、内部運用語を削除。 |
| `pwa/bzm/9-4-ers-rubric.md` | `public_rewrite` | rubric本体は `public_keep` に近い。lines 5, 7, 107 の AMD/path/正本は置換。 | 研究機関自己点検付録として残す。 |
| `pwa/bzm/9-5-appendix-changelog.md` | `internal_only` | `/bzm`変更履歴、routing、作業者、スタパ素材取り込み履歴。 | 公開本から除外。制作履歴として保持。 |
| `pwa/bzm/COMMANDER_TASKS.md` | `internal_only` | BZM司令塔台帳、worker報告、thread id、運用ゲート。 | 公開対象外。 |

## Forbidden Term Hits And Replacement Plan

| File | Hits | Replacement plan |
|---|---|---|
| `0-1-preface.md` | `AMD=20`, `D-7 Textbook Insights=3`, `/spec=1`, `正本=2`, `チームアルマダ=1` | AMD/チームアルマダは著者注へ1回だけ。D-7 Textbook Insightsは「掲載判断を通した現場知」へ。正本/pathは削除。 |
| `1-1-why-before-zero.md` | `AMD=3`, `まさ=1` | 「私たち/支援現場/過去ケース」に置換。まさ根拠は field observation へ。 |
| `1-2-before-zero-field-landscape.md` | `AMD=4` | 「伴走者」「事業化支援チーム」に置換。 |
| `1-3-field-frictions-and-patterns.md` | `AMD=6`, `スタパ=1`, `文字起こし=1` | スタパ/文字起こしは本文から削除し匿名場面へ。AMDは「支援者/伴走チーム」へ。 |
| `1-4-gates-and-judgment-branches.md` | `AMD=4`, `D-7 Textbook Insights=1` | AMDは「支援チーム」へ。D-7 Textbook Insightsは公開本文から削除。 |
| `1-5-relationships-and-learning.md` | `AMD=4`, `D-7 Textbook Insights=1` | 学習ループは読者向け「記録・分類・一般化・再利用」に変換。 |
| `1-6-field-elements-to-bzm-variables.md` | `AMD=19`, `まさ=1` | `frl_cap_amd` は `support_capability` 等へ改名検討。AMD列は「支援者が見ること」へ。 |
| `2-1-sigma-su-triple-helix.md` | `AMD=1`, `まさ=1` | 引用を一般命題へ。会社ロゴ言及は削除。 |
| `2-2-state-space-model.md` | `まさ=1`, `正本=1` | 内部根拠ではなく「本書では扱わない詳細」へ。 |
| `3-1-xrl-group.md` | `AMD=1` | Shallow Tech の会社対象説明を一般化。 |
| `4-1-frl-founder-readiness.md` | `AMD=18`, `まさ=10` | まさ引用を「現場での観察命題」へ。AMD提供価値は内部onlyか著者注へ退避。 |
| `5-1-amd-score-integration.md` | `AMD=27`, `まさ=3` | 指標名を公開名へ。AMD action/UI/実装バグは削除または制作注へ。 |
| `6-1-retrofit-verification.md` | `AMD=23`, `まさ=6`, `正本=2` | PJ名とまさ主観を匿名ケース/過去支援ケースへ。正本参照は公開脚注から削除。 |
| `7-1-ers-ecosystem-readiness.md` | `AMD=29`, `まさ=1`, `pwa/=2`, `正本=2` | 研究機関向け自己点検に寄せる。path/正本/UIは削除。 |
| `8-1-amd-os-operations.md` | `AMD=30`, `D-7 Textbook Insights=2`, `pwa/=3`, `正本=1` | 章ごと内部only。理論要約だけ他章へ吸収。 |
| `8-2-field-decisions-and-branches.md` | `AMD=2`, `D-7 Textbook Insights=6`, `candidate=4`, `local applier=1` | 公開本文から削除。判断分岐テンプレだけ別章に新規化。 |
| `8-3-failures-pivots-and-revisions.md` | `D-7 Textbook Insights=4`, `candidate=2`, `local applier=1` | 内部追記手順は削除。失敗学習の型だけ公開化。 |
| `8-4-relationship-playbook.md` | `D-7 Textbook Insights=4`, `candidate=3`, `local applier=1` | 内部追記手順は削除。相手カテゴリ別プレイブックへ。 |
| `8-5-before-zero-checkpoints.md` | `AMD=1`, `D-7 Textbook Insights=5`, `candidate=4`, `local applier=1` | OS/L2語を消し、読者のチェックポイントへ。 |
| `9-1-references.md` | `AMD=6`, `pwa/=2`, `正本=8` | 内部正本セクションを公開版から削除。 |
| `9-2-notation.md` | `AMD=3` | 指標名だけ公開名へ合わせる。 |
| `9-3-glossary.md` | `AMD=10`, `pwa/=2`, `正本=2` | 公開用語集から内部path/正本語を除外。 |
| `9-4-ers-rubric.md` | `AMD=1`, `まさ=1`, `pwa/=2`, `正本=4` | rubric本体は保持。内部根拠行のみ削除。 |
| `9-5-appendix-changelog.md` | `まさ=3`, `D-7 Textbook Insights=2`, `/spec=1`, `正本=1`, `スタパ=2`, `文字起こし=1`, `routing=2` | 公開本から除外。 |
| `COMMANDER_TASKS.md` | `司令塔=26`, `worker=19`, `candidate=4`, `D-7 Textbook Insights=4`, `AMD=6`, other internal terms | 完全に内部only。 |

## AMD-Promotion Risk

特に「AMD推し」に見える箇所:

- `0-1-preface.md`: 読者定義に AMDメンバー/AMD OS 利用者が入り、公開本の主語が社内へ戻る。
- `1-1-why-before-zero.md`: AMD の会社紹介から始まり、Before Zero が読者課題でなく AMD活動説明に見える。
- `1-6-field-elements-to-bzm-variables.md`: `AMD が見るべきもの`、`frl_cap_amd`、`AMD が担う` が連続し、支援者一般の本ではなく自社手法説明に見える。
- `4-1-frl-founder-readiness.md`: `AMD の提供価値の定量化` は公開本文だと宣伝に見えやすい。
- `5-1-amd-score-integration.md` / `6-1-retrofit-verification.md`: `AMD Score` と AMD過去PJの整合性が強く、客観モデルより自社実績の正当化に見える。
- `8-1-amd-os-operations.md`: 章全体が product/internal operations で、販売本には不要。

読者主語への変換方針:

- `AMD が見るべきもの` -> `支援者が確認すべき問い`
- `AMD の伴走余地` -> `外部支援で補完できる機能`
- `AMD の提供価値` -> `支援者が補える経営実務`
- `AMD Score` -> `Before Zero Readiness Score` など公開名を検討
- `まさの経営判断/直感` -> `事業化支援の現場で繰り返し観察される命題`
- `AMD OS` -> 公開本文では削除。必要なら「内部の運用システム」ではなく「継続的な記録と見直しの仕組み」として一般化。

## Public Rewrite Priorities

1. `1-3` and `1-4`: スタパ由来の素材を最優先で匿名ケース化する。販売本の読者が一番「自分の現場だ」と感じる部分。
2. `1-6`: 現場語から理論変数への橋として公開本の背骨にする。AMD列を読者向け問いへ変える。
3. `4-1`: 創業者機能分解を公開本の強い差別化要素にする。まさ引用/AMD補完は外す。
4. `7-1` and `9-4`: 研究機関・産連・URA向けの実用章/付録として磨く。
5. `2-1` to `5-1`: 理論章は残すが、field-first bridge と公開名を整えて後半に置く。

## Internal-Retreat List

公開本から退避すべきもの:

- `D-7 Textbook Insights`, `candidate`, `local applier`, `source refs`, `routing`, `metadata_json`, `source_hash`
- `AMD OS`, UI, deploy, Vercel, `/spec`, `pwa/`, `before-zero/theory/` などの path
- `正本`, changelog, append-only, worker/司令塔/task ledger
- まさの個人名を権威として使う引用
- スタパイベント名、文字起こし由来であること

退避先:

- 内部制作判断: `pwa/bzm/textbook/COMMANDER_TASKS.md`
- audit/source notes: `pwa/bzm/textbook/runs/*.md`
- public manuscript lint/production notes: future `pwa/bzm/textbook/production-notes/*.md`

## Next Actions

1. Public TOC worker が `PUBLICATION_STRATEGY.md` ベースで公開章立てを作る。
2. Rewrite worker は `1-3` / `1-4` の case_seed から、イベント名を出さない公開シーンを作る。
3. Theory humanization worker は `1-6` を橋にして `2-1`〜`7-1` の冒頭に field-language bridge を足す。
4. Publication lint worker は将来の `public-manuscript/` に対して禁止語検査を作る。現行 `pwa/bzm/*.md` は内部sourceなので lint対象にしない。
