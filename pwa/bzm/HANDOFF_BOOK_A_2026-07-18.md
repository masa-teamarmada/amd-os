# Book A Publication Handoff

Last updated: 2026-07-21 JST

Topic: 司令塔06 → 司令塔07 — 承認済みあらすじを北極星に全15章を通しドラマへ磨く

Working root: `/Users/masa/projects/AMD/amd-os`

BZM root: `/Users/masa/projects/AMD/amd-os/pwa/bzm`

## Summary

- まさは短いネタバレ版あらすじ「空欄を埋める人」を承認し、「これで進めよう」と決定した。
- 承認全文を `BOOK_A_SCENARIO_DRAFT_3.md` 冒頭へ北極星として固定した。次工程は、この感情曲線、速度、爽快感を全15章の設計と本文へ実装することである。
- 主人公は柏木美咲一人。複数PJと複数人物は、美咲の選択、損失、関係、権限の変化へ収束させる。群像劇、オムニバス、旧見届け人設計へ戻さない。
- 全理論を物語の背景へ含める。各章の中心理論だけでなく、`BOOK_A_MASTER_PLAN.md` §9のwas、therefore、数式、導出、発展Boxを、A・B・C PJにおける比較、計算、検証、棄却、説明へ使う。
- 終着点は成長とハッピーエンドである。URAが憧れられる職業になり、AMD型独立主体がBefore Zeroに欠けていた仕事だと、売上、判断時間、顧客、雇用、研究、再依頼、制度化、後進の選択から伝わる形にする。
- 現実性、公平性、権限境界は基礎条件である。守りの否定文を前面へ出し、主人公の勢い、快進撃、感情的報酬を弱めてはならない。

詳細記録は `pwa/design_log/sessions_2026-07.md` の「2026-07-21 Book A 承認済みあらすじ固定・司令塔06→07 handoff」を参照する。

## Current Canonical Truth

1. `BOOK_A_SCENARIO_DRAFT_3.md` — 承認済みあらすじ、五幕、全15章の因果設計、理論coverage
2. `BOOK_A_CHARACTER_BIBLE.md` — 柏木美咲と全人物の人物正本
3. `BOOK_A_INDEPENDENT_AGENCY.md` — AMD型独立主体、研究主権、資金からの非捕捉
4. `BOOK_A_MASTER_PLAN.md` — 15章の理論順序、数式、was／therefore、執筆規律

`BOOK_A_STORY_WORLD.md`、`BOOK_A_NARRATIVE_DESIGN.md`、`BOOK_A_CHARACTER_NAMES.md`、Draft 1／2は2026年7月20日に全面失効した履歴資料であり、部品を再利用しない。

## Non-negotiable Gates

1. 柏木美咲が全15章を貫く唯一の主人公である。
2. 各章は前章の帰結から始まり、美咲の不可逆な選択を通って、次章でしか回収できない問いを残す。
3. 美咲は明るさ、速度、翻訳、招集力を失わず、能動的な非主体から限定権限、自己損失、異論義務、返却期限を持つ独立主体へ成長する。
4. 「助言した人は、株を失わない」を前半から後半への感情的転換点にする。
5. 誤判断後を縮こまる反省譚にせず、記名訂正、電話、再招集から快進撃へ切り替える。
6. Ch15は条件違反を守っただけで閉じず、顧客、雇用、研究、次の試験を残し、真一の自己署名へつなぐ。
7. エピローグは大学による専門職化、菜月の職業選択、新URAの最初の電話、美咲の「よし。じゃあ次の人も、今日つないじゃおう」で閉じる。
8. 研究主権と正式決定者を守るが、注意書きの羅列でドラマを止めない。

## Unresolved Tasks

1. **最優先**: `BOOK_A_SCENARIO_DRAFT_3.md` を、承認済みあらすじの感情曲線と爽快感を全15章で体験できる通しドラマへ磨く。
2. 15章本文を現行Scenario Draft 3へ全面追随させる改稿設計を作る。旧章頭ナラティブは白紙化済みであり、局所的な差し替えや旧場面の救済から始めない。
3. 各章で全理論coverageと物語上の因果を照合し、講義パートがドラマを中断しない章内接続を設計する。
4. 設計合格後、全15章本文を順次執筆・再執筆し、kaku規範で通読監査する。

## First Next Action

司令塔07は、最初にrootの `SESSION_MIGRATION_PROMPT.md` の順で正本を読む。

その後、実作業を自分で抱えず、別ワーカーへ次の一件を委譲する。

> 承認済みあらすじ「空欄を埋める人」を北極星として、`BOOK_A_SCENARIO_DRAFT_3.md` の全15章をコールドリードし、どこで感情曲線が途切れるか、どこで守りの否定文が勢いを殺すか、どこで理論説明がドラマを止めるかを厳しく診断する。旧ナラティブは参照せず、具体的な再設計案を章横断で返す。正本編集は司令塔レビュー後の別ワーカー工程とする。

司令塔は成果を正本で検証し、北極星との一致を判断する。

## Repo State

- Branch: `main`。新branch／worktreeは禁止。
- handoff作業の最終同期時点のHEADと`origin/main`: `9d3f6e71`で一致。
- このhandoff bundleのcommitは、このファイルを含む最新の`origin/main`を`git log -1 --oneline`で確認する。
- handoff開始時にあったH-1レーンの無関係dirty 4件は、同レーンが`9d3f6e71`までにcommit／pushした。このhandoff作業では内容変更、stage、restoreをしていない。
- 最終同期時点で、対象5ファイル以外のdirtyはない。
- 対象ファイルだけをstage／commitする。`git add .`、`git add -A`は禁止。

## Pointers

- 司令塔07用プロンプト: `/Users/masa/projects/AMD/amd-os/SESSION_MIGRATION_PROMPT.md`
- 承認済みあらすじと全15章設計: `BOOK_A_SCENARIO_DRAFT_3.md`
- 人物正本: `BOOK_A_CHARACTER_BIBLE.md`
- 独立主体正本: `BOOK_A_INDEPENDENT_AGENCY.md`
- 理論・章順正本: `BOOK_A_MASTER_PLAN.md`
- 変更履歴: `9-5-appendix-changelog.md`
- セッション記録: `../design_log/sessions_2026-07.md`
- 過去バグ・教訓: `../BUGS.md`

## Design Sync Inventory

| 変更 | 正本 | session log | manual同期 |
|---|---|---|---|
| 承認済みあらすじと北極星 | `BOOK_A_SCENARIO_DRAFT_3.md` | `sessions_2026-07.md` | 対象外 |
| 司令塔06→07の現在地 | 本HANDOFF | `sessions_2026-07.md` | 対象外 |
| 次セッション開始手順 | root `SESSION_MIGRATION_PROMPT.md` | `sessions_2026-07.md` | 対象外 |

対象外理由: 今回はBook Aの原稿・物語設計・出版司令塔運用だけを更新し、AMD OSのランタイム、利用者導線、操作仕様を変更しないため。
