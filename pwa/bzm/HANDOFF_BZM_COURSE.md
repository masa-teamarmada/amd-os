# HANDOFF　BZM批判的基礎講座

> **更新日**：2026-08-08
>
> **仕事種別**：非開発PJ作業（BZM理論の批判的講座とSPS 2.0の測定設計）。ただし教科書目次への章登録で`pwa/src/app/(app)/bzm/bzm-chapters.ts`を1件変更している。
>
> **正本パス**：`/Users/masa/projects/AMD/amd-os/pwa/bzm`

## 最新セッションの要約

2026-08-07〜08。測定可能性ゲート全7問の確定、SXへの実測（v0.2〜v0.5）、そして**到達見込みモデルの構造確定**まで進んだ。到達した理論は教科書の新章3本へ正本化し、目次トップに部として登録した。

- **理論の中核が決まった**：本当の締切は資金の崖だけが作る。計画上の期限$H_v$は延ばせるが資金の崖は延ばせない。前者は$T_C \le H_v$という判定条件、後者は$T_C < T_Y$の経路打ち切りとして、モデルの別の場所に入る。まさの一文「締切を遅らせれば成功確率は上がるが、資金がショートする場合はそうではない」が構造を確定させた。
- **SX実測はv0.5で$q=0.0415$**［CI 0.0378〜0.0456］。版推移0.0131→0.0016→0.0335→0.0415はすべて「誰の・何の情報で・どこを直したか」のタグつき。v0.4の20倍戻しは**時間入力の誤読の訂正**（設立手続きをSeed合意後の直列3か月と読んでいた）であり、結果合わせではない。
- **戦略余力$T_Y$は資金成分だけの部分実装**であることを明示した。$C_j/b_j$は$T_Y$と等価ではなく、$\min$の第一成分。顧客信用・チーム・知財・代替選択肢は現在**欠測**で、そのぶん$q$は過大評価側に偏る。
- 教科書へ [到達見込みモデル](./sps-2-0-reachability-model.md) / [測定可能性ゲート](./sps-2-0-measurability-gate.md) / [SX実測記録](./sps-2-0-sx-measurement-log.md) の3章を新設し、`bzm-chapters.ts`の目次先頭へ「SPS 2.0 到達見込み」部として登録。既存Book A 15章の番号・順序に影響なし（章番号は2026-06-28に廃止済み）。
- **既存バグを1件発見して記録した**：教科書章の相対リンクに`.md`を付けると必ず404になる。コード実測で原因を確定し`pwa/BUGS.md`へ追記、`course-bzm-foundations-index.md`の実害3件を修正した。恒久的なリンク正規化は未実装。

Session 0とSession 1の講義資料は`live-reviewed v1.0`。

## 正本の分担（どれを読ませ、どれを台帳として使うか）

| 種別 | ファイル | 役割 |
|---|---|---|
| 教科書章（PWAの`/bzm`に表示） | `sps-2-0-reachability-model.md` | 到達見込みモデルの定義・原則。`theory-fixed v1.0` |
| 教科書章 | `sps-2-0-measurability-gate.md` | 数字を出してよい条件（7問）。`questions-fixed v1.0` |
| 教科書章 | `sps-2-0-sx-measurement-log.md` | SX実測の版推移と感度。`measurement-log v0.5` |
| 運用台帳（教科書に出ない） | `BZM_2_0_MEASURABILITY_GATE.md` | 確定文・証拠パッケージ表・変更履歴の正本 |
| 運用台帳 | `SPS_2_0_PREREGISTRATION_SX_2026-08-07.md` | SX事前登録。5.4〜5.5節に設計変更、9〜16章に各版の実行記録 |
| 一次資料 | `pilot/*.json` / `pilot/*.mjs` | 凍結入力・結果・計算コード |
| 撤回済み | `SPS_2_0_PILOT_TRIAL_2026-08-04.md` | v0.1。入力票様式のドライランとしてのみ残す |

大文字始まりのファイルは`isBzmChapterFile`（`bzm-data.ts`）が章として扱わないため、台帳が教科書目次に混ざることはない。

## 全体工程と現在地

1. 目的・非目的の固定：完了。
2. 理論構造$\mathbf{SPS}=q\mathbf P$：`theory-fixed v1.0`（到達見込み側）。$\mathbf P$側は未着手。
3. 測定設計（観測可能な定義・算出規則・停止条件）：完了（ゲート7問クローズ）。
4. 1PJで入力を凍結する有効な試行：**SXでv0.5まで完了。現在地**。
5. 複数評価者・複数PJによる前向き検証と校正：未着手。前向き検証は0件。
6. 単一表示、全PJ更新、GOとの関係、PWA実装：未着手。

## 次セッションの最初の一手

**戦略余力$T_Y$の非資金成分を、欠測のまま置くかv0.6で復活させるかを決める。**

まさの問いかけ「財布／燃焼と戦略余力は等価？戦略余力にはお金以外の成分も含まれるよね？」から始まった議論の続き。まさは「そしたらそこを継続して議論しよう」と明言している。

論点は次の3つ。

1. **復活させるなら翻訳規則が要る**。顧客信用やチームの余力を「あと何か月分あるか」に変換する再現可能な手続きを書けるか。書けなければ、入れても出所タグが`assumption`になり、v0.1と同じ失格条件に触れる。
2. **二重カウントの危険**。工程の成功確率をヒアリングで聞くとき、まさは非資金成分の枯渇リスクを暗黙に織り込んでいる可能性が高い。独立ノードとして足すと同じリスクを二度数える。
3. **欠測のまま置く場合の代償**。現在の$q$は過大評価側に偏る。この偏りを「限界として明記する」以上のことをしないという判断を、明示的に取るかどうか。

反証条件は事前登録5.5節に置いてある。資金以外の独立した喪失事象が実際に経路を止めた事例が観測されたら復活を検討する、という条件付き設計になっている。この条件のままでよいかを含めて議論する。

説明は平易な日本語で行い、数問ごとに全体目的（$q$のゴールライン作り）へ張り直す（2026-08-06まさ差し戻しの恒久対応）。

## 未解決

1. $T_Y$非資金成分の扱い（上記＝次の一手）。
2. 仮定として残る入力の置換：Phase 1〜3の所要時間幅、各フェーズの燃焼レート幅、Phase 3の燃焼。まさが月次数値計画を作る予定で、それを文書由来へ格上げする。
3. ゲート文書への追記：「手応えを聞くときは、その工程が何と並行し何の後に来るかを工程ごとに明示する」規律を証拠パッケージ表へ入れる。
4. 2件目のPJへの適用。$q$の分布が全体に低い側へ寄り、PJ間比較の分解能が落ちないかの点検。
5. $q^{self}(\pi_{BZSF})$と$q^{self}(\pi_0)$、追加効果$\Delta q$の識別条件。
6. 共通目標に対応する$\mathbf P$の尺度、条件付きDCF、社会的価値rubric。
7. 設立後に必要となる状態変数と、Before Zero入力をそのまま使えない反例。
8. `BZM_2_0_DIAGNOSTIC_SCORE_SPEC.md`の「試行済み」「校正前なら試行を妨げない」という記述が、測定可能性ゲートを欠くため現在の設計と不整合。同期が要る。

## Repo状態

- 作業場所：`/Users/masa/projects/AMD/amd-os`、branch：`main`。
- **この`main`は複数セッションが同時にcommitを積む共有checkout**。ahead/behindの数は刻々と変わるので、**具体数を当てにせず、開始時に`git log --oneline -10`と`git status -sb --untracked-files=all`で必ず再確認する**。参考値として2026-08-08のcloseout時点は`ahead 10, behind 71`（同日のhandoff commit直後は`behind 67`だった）。
- 未pushコミットは、本数ではなく所属で見る：
  - `5ecb7b0c`以降のBZM関連commit（新章3本＋目次登録＋測定台帳＋`pilot/`＋BUGS記録＋changelog＋handoff）= **このセッションの成果**
  - `8c19f2f3` = 前セッションのBZM作業
  - `8642bc8f`（kute規程コックピットタブ）= **別セッション**
  - `f2adac92` / `504f9004` / `6012a6ac`（立替のSlack通知・Drive保管・24hリマインド）= **別作業**
- handoffで更新してcommitした対象は4ファイル：このHANDOFF、`SESSION_MIGRATION_PROMPT_BZM_COURSE.md`、`pwa/BUGS.md`、`pwa/bzm/course-bzm-foundations-index.md`。
- BZM外に大量のステージ済み・未追跡変更がある（project-workspace系のSX管理UI11ファイル、migration 227、Project Share 6PJの`memberStore.mjs`/`members.mjs`/テスト24ファイル）。**別セッションの作業なので触らず、stage、commit、restoreしない**。
- push、deploy、外部公開、本番データ書き込み：**未実施**。この講座タスクでは、まさが明示しない限り行わない。加えて`behind`が大きい状態で単純pushすると別作業のcommit4本まで巻き込むため、実務上も単純pushは不可。BZM分だけを出すならcherry-pickする。
- branch、worktreeは新規作成していない（このセッションで作ったもの：none）。開発用`design_log/`は対象外。
- OSマニュアル同期：**対象外**。`bzm-chapters.ts`を変更したが、これは教科書目次データであり、`manual-chapters.ts`にBZM教科書の章管理は存在しない（grep 0件）。manual/spec/bzmの3層分離は`pwa/manual/9-2-developer.md:21`に既出で、今回の追加はその分担どおり。AMD OSの製品仕様・UI導線・DB・権限は変更していない。

## 読む資料

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/CLAUDE.md`
4. `/Users/masa/projects/AMD/amd-os/pwa/AGENTS.md`
5. `/Users/masa/projects/AMD/amd-os/pwa/bzm/AGENTS.md`（BZM構築セッションの研究規律）
6. このHANDOFF
7. [`sps-2-0-reachability-model.md`](./sps-2-0-reachability-model.md)（到達見込みモデル正本）
8. [`sps-2-0-measurability-gate.md`](./sps-2-0-measurability-gate.md)（測定可能性ゲート）
9. [`sps-2-0-sx-measurement-log.md`](./sps-2-0-sx-measurement-log.md)（SX実測記録）
10. [`SPS_2_0_PREREGISTRATION_SX_2026-08-07.md`](./SPS_2_0_PREREGISTRATION_SX_2026-08-07.md)（事前登録台帳。5.4〜5.5節と9〜16章）
11. [`BZM_2_0_MEASURABILITY_GATE.md`](./BZM_2_0_MEASURABILITY_GATE.md)（ゲート運用台帳）
12. [`BZM_2_0_DIAGNOSTIC_SCORE_SPEC.md`](./BZM_2_0_DIAGNOSTIC_SCORE_SPEC.md)（未解決8の不整合あり）
13. [`course-bzm-foundations-s01.md`](./course-bzm-foundations-s01.md)
14. [`BZM_2_0_REVISION_REQUIREMENTS.md`](./BZM_2_0_REVISION_REQUIREMENTS.md)
15. `/Users/masa/projects/AMD/amd-os/pwa/spec/4-2-amd-score-current-spec.md`

次回用の完全な起動文は、[SESSION_MIGRATION_PROMPT_BZM_COURSE.md](./SESSION_MIGRATION_PROMPT_BZM_COURSE.md)に保存する。
