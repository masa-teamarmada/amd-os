# 2026-07-17 Ch11 (二層非可換性) 理論パート v1 ワーカー closeout ノート

*ワーカー: fable セッション (worktree `clever-cerf-6204aa`、spawn_task 起票) / 司令塔: `Book A 司令塔 04` (`local_8f5e95be...`)。司令塔へ cross-session 完了報告済み (2026-07-17)。*

## このワーカーの担当と結末

Book A 第11章 (二層非可換性 — 案件と機関を混ぜてはいけない理由) の**理論パート v1** を起草したワーカー。起票時のスコープ (章頭ナラティブ白紙構想 3案 + 本文一気書き) は、司令塔の軌道修正 (まさ元指示 = 「理論パートを全セクション、セクションごとにセッションを立ち上げる」) により**理論パートのみ**へ確定。章頭ナラティブ・討議課題A・柏木の編み込み・白紙構想 3案は未着手のまま別プロセスへ委譲 (捨てた作業なし)。**まさ承認待ちの状態で closeout**。

## 成果 (commit、いずれも origin/main へ push 済み)

| commit | 内容 |
|---|---|
| `8fbf693` | `pwa/bzm/book-a-ch-11.md` 新規 — 理論パート 11.1〜11.7 (約13,300字。章頭 3,000字前後が入って章帯域に収まる設計)。11.1 複合指標の系譜 (OECD/JRC・大学ランキング・Arrow・Simpson+Goodhart) / 11.2 集約形の導出 (生き物の掛け算・道具箱の足し算、第3章表3-3 の弧を受ける) / 11.3 公理 A1-A4 + 二層非可換性定理 + 証明スケッチ (三方向崩壊: 乗法→A3、加法→A1、一般単調合成→境界条件) + 非可換の名の由来 / 11.4 Simpson 反転 worked example + 四分位不安定性 / 11.5 UI 禁止則 + 並置の作法 + Box 11-A 反対意見書の型 / 11.6 Goodhart 回避の機関 KPI 3条件 / 11.7 演習3本 + 90分運用例 + 到達目標 + 読書案内 + 次章 (円卓) への橋 |
| `edad4bb` | 11.0 プレースホルダ追加 (「※本章の章頭ナラティブ (11.0節) と討議課題Aは、別セッションで執筆する。」 — Ch12 `820d17c` と同形式) |

kaku 点検手順 (話題テスト・LLM 空句照合・冗長排除・緊張台帳・拍・境界) 通し済み。地の文の 2 倍ダッシュ不使用 (節見出しの「——」は既存章の型として維持)。

## 意思決定ログ (次回の骨抜き・手戻り防止用)

- **A1 (案件消滅) の min に M を含めない**: 公理は min(P,R,S)→0 ⇒ f→0。モノグラフ skeleton (`CHAPTER_10_4_SKELETON.json`) の min(P,R,S) に忠実。4因子化 (SPS=M×P×R×S) 後に機械的に M を足すと「無風の案件は無価値」となり第5章の自走型 (追い風なしで生きる) と矛盾するため、「無風は案件を遅くするが、殺しはしない」を 11.3 に明文化。M・P は機関の手が届かない因子、A3 のチャネルは R・S のみ、という非対称も本文化 (4因子分解が「機関の手が届く/届かない」の線を引けるようにした、という読みを与えた)。
- **三方向崩壊の対応**: 乗法は A1 ○ / A3 × (機関項の増分が案件の点数 g に比例する = 仕事と無関係な量で仕事の価値が伸縮)、加法は A3 側 ○ / A1 × (NO_GO 案件が機関の点数で配分の列に並び直す)、一般単調合成は A1 の境界 (死案件では機関差が無効) と A2 の内点 (生案件では有効) を一つの増加関数 Φ が両立できない (結合測定の二重相殺条件の反例)。skeleton の Case (a)(b)(c) 1対1 対応を維持。
- **Simpson worked example は自作の架空データ**: 機関X (ECR 82%、15件中8件前進 53%) vs 機関Y (ECR 46%、20件中7件 35%)。層別では高SPS層 70% vs 75%、低SPS層 20% vs 25% で両層 Y 優位 → プールで X 優位の反転。検算済み。演習11-1 の境界探し (X の高SPS件数 n<4.5 で逆転) も成立確認済み。四分位不安定性は ΔV = SPS×0.10 の「係数の踊り」(SPS 320 → +32 / SPS 70 → +7) で降圧。
- **Goodhart 接続**: 「第5章の自走 S = ゲームしにくい結果変数 (自走を偽装する方法は実際に自走することだけ)」の論理で lite に書き、完全版は第14章 (出口ポートフォリオと機関の期待還流) へ送った。
- **既存章の釘の回収 2 件**: 第3章 3.6 末尾「掛け合わせて一つの点数にしてはいけない理由は第11章で論じる」→ 11.1 末尾で回収。第9章 10.6「なぜ融かせないかの深い理由は第11章に譲る」→ 11.5 で回収 (SPS×GO と SPS×ECR を「演算の型が違う物差しの合成」という共通病理で束ねた)。
- **統合章 v4 追随**: P のオーナー章 = 第3章 (2026-07-16 案3確定)、統合章 = M×R。11.3 の前方参照は「天井P は技術と市場が決める (第3章)」「風M は機関の外の状態 (第4章、第6章)」。
- **討議課題A・連作免責統一注記は章頭担当セッションへ委譲**: 既存章の配置正本 (章頭ナラティブ直後) に従う。90分運用例には討議課題A 10分の枠を確保済み。
- **節構成は 11.7 統合型** (演習+到達目標+読書案内で1節)。Ch10 (10.9 統合型) の構造を模倣。

## 申し送り (未完タスク)

| # | タスク | 実行タイミング / 担当 |
|---|---|---|
| 1 | まさ承認 → 指摘反映 | 本ワーカーまたは次セッション |
| 2 | `pwa/bzm/9-5-appendix-changelog.md` へ Ch11 行追記 | まさ承認後。root の同ファイルは他レーンが staged 保持中のため、clean clone 経由で追記する |
| 3 | `bzm-chapters.ts` の slug 再マッピング | 掃討レーン (司令塔へ報告済み)。現行 slug 系列は旧番号 (`book-a-ch-11`=第10章ECR / `book-a-ch-12`=第11章) のままで、新章ファイル群 (ch-11=第11章、ch-12=第12章、ほか並行章) と食い違う。Ch11 status の in-progress 化も再マッピングと同時が正 |
| 4 | 11.0 章頭ナラティブ + 討議課題A + 連作免責注記 | 章頭担当の別セッション (別プロセス) |

## git / worktree / branch 状態

- 成果は全て origin/main へ push 済み (`8fbf693`, `edad4bb`)。
- **push 手順**: root checkout (main) は他レーン tracked dirty 5件 (`9-5-appendix-changelog` [staged] / `design/README` / `design/db_schema` / `manual/9-3` / `spec/6-1`) + untracked 1件 (`2026-07-16_narrative_rebuild_ch12_v1.md`) が pull 障害のため、AGENTS.common 許容の **disposable clean clone** (file:// ローカル clone → origin URL 差し替え → ff pull → 対象ファイルのみ add → push) で実施。使用した clone は全て削除済み。
- root checkout 上の patch-equivalent untracked (私の ch-11 コピーと Ch12 セッションの ch-12 コピー、いずれも origin と同一を diff 検証済み) は削除して pull 障害を 2 件減らした。root は依然 behind (残る障害は他レーン所有)。
- このセッションで作った branch / worktree: **none** (Claude Code 自動生成 worktree `clever-cerf-6204aa` / branch `claude/clever-cerf-6204aa` は未使用・変更なし。disposable clean clone は使用後すべて削除済み)。

## 次セッション migration prompt (まさ承認後の反映用)

```
あなたは Book A『ディープテック起業の経営学』第11章 (二層非可換性) の承認後反映を担当するセッション。作業ルート = /Users/masa/projects/AMD/amd-os。

## 最初に読む (この順)
1. /Users/masa/projects/AGENTS.common.md — 共通人格・運用ルール
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md — AMD level memory
3. /Users/masa/projects/AMD/amd-os/CLAUDE.md — モノレポルール (ブランチ禁止・git add . 禁止)
4. pwa/bzm/2026-07-17_ch11_theory_v1_closeout.md — 前セッション closeout (意思決定ログ・申し送り)
5. pwa/bzm/book-a-ch-11.md — 対象本文 (理論パート v1、まさ承認待ち)
6. 指摘内容に応じて: pwa/bzm/BOOK_A_MASTER_PLAN.md §9 Ch11 行 / pwa/bzm/CHAPTER_10_4_SKELETON.json (定理正本) / pwa/bzm/terminology_glossary.md §4 (4層対応表)

## 状態スナップショット (2026-07-17 closeout 時点)
- book-a-ch-11.md 理論パート v1 = origin/main 反映済み (8fbf693 + edad4bb)。11.0 はプレースホルダ (章頭は別プロセス)
- まさ承認待ち。承認 or 指摘が来たら本 prompt の次タスクを実行
- root checkout は behind + 他レーン dirty で pull 不能 → 編集・push は disposable clean clone 経由 (closeout md の「git / worktree / branch 状態」参照。root には書かない)
- 執筆規範 = kaku 入口 (~/.claude/skills/kaku/SKILL.md) 経由で 2 規範 Read → 提出前に点検手順を通す (恒久ルール)
- まさへの確認質問は最小限 (理論パート範囲は自分で判断、事後報告)

## 次タスク (優先順)
1. まさの指摘を本文へ反映 (kaku 点検を再度通す) → clean clone 経由 commit & push
2. pwa/bzm/9-5-appendix-changelog.md へ Ch11 行を1行追記 (フォーマットは既存行に揃える。まさ承認が下りた commit と同時)
3. 司令塔 (list_sessions で現行世代を確認してから) へ cross-session 報告
4. bzm-chapters.ts の slug 再マッピングは掃討レーン管轄 — 依頼が来た場合のみ対応

## 確立済み運用ルール
- ブランチ・worktree 作成禁止 (main 一本)。git add . 禁止、フルパス明示 stage のみ
- 他レーン dirty (9-5 [staged] / design/README / design/db_schema / manual/9-3 / spec/6-1 / narrative_rebuild_ch12_v1) には一切触れない
- 他章本文 (book-a-ch-1〜10, 12 以降)・統合章 (book-a-ch-4-5.md) は Read only
- 分量: 章頭込み 22,000字上限 (数理章)。現理論パート約13,300字
- A1 の min に M を含めない等の理論判断は closeout md の意思決定ログが正 — 安易に覆さない (覆す場合はまさ確定を取る)
- push は成功を終了コードで確認してから clone を削除する (2026-07-17 の並行 push 割り込みで rejected のまま clone を消しかけた教訓)
```
