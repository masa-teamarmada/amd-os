# SESSION MIGRATION PROMPT — SX MS予算不足修正

```text
cd /Users/masa/projects/AMD/amd-os

あなたは、株式会社チームアルマダの社内OS「AMD OS」を引き継ぐえいみ。
今回の受領済み作業は、SXのMS設定ページで「会社留保」が9,069,525円へ膨らみ、PJ予算を5,370,277円超過したとして `MS編集停止中` になっていた不具合の修正。実装commit `700a438e8393e17e791bbb05070fe88a15b17d50` はmain・productionへ反映済みで、同じ修正をやり直さない。

## 最初に読む順

1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/HANDOFF.md
4. /Users/masa/projects/AMD/amd-os/AGENTS.md
5. /Users/masa/projects/AMD/amd-os/CLAUDE.md
6. /Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md
7. /Users/masa/projects/AMD/amd-os/pwa/spec/1-1-overview.md
8. /Users/masa/projects/AMD/amd-os/pwa/spec/1-2-document-layer-migration-map.md
9. /Users/masa/projects/AMD/amd-os/pwa/design/README.md
10. /Users/masa/projects/AMD/amd-os/pwa/design/season_budget_actual.md
11. /Users/masa/projects/AMD/amd-os/pwa/manual/6-8-admin-ms-overview-spec.md
12. /Users/masa/projects/AMD/amd-os/pwa/manual/7-1-reward-calc-spec.md
13. /Users/masa/projects/AMD/amd-os/pwa/manual/6-6-member-billing-prompts-spec.md
14. /Users/masa/projects/AMD/amd-os/pwa/manual/9-3-appendix-changelog.md
15. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md の2026-07-29 `finance/admin-ms` 項目
16. /Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md の「2026-07-29 — SX MS予算不足」節

## 状態スナップショット

- canonical cwd / branch: `/Users/masa/projects/AMD/amd-os` / `main`
- accepted implementation: `700a438e fix(pwa): correct MS noncash allocation budget guard`
- accepted production: `v3.51.17` / implementation SHA `700a438e...` は反映済み。その後、別ownerのW-Prep文書commit `f936e278` と、このpromptを含むcloseout文書commitもmain・productionへ反映済み。正確なcurrent SHAは開始時にlocal HEAD・origin/main・production `/api/build-info` から読み直す。
- SX current truth: client 10,480,000円 / buffer 1,800,000円 / PJ budget 5,642,000円 / cash payout 1,942,752円 / 対象外配賦 3,085,723円 / obligation 5,028,475円 / 期末未払0円 / 残予算613,525円。
- 画面の旧9,069,525円は、実際の当月非現金配賦合計3,085,723円に、同じ債務を翌月へ持つ月末stock残高5,983,802円を9か月分重複加算した値。`stockYen` はフローではなく残高スナップショットなので期間合計しない。
- 13ptは120pt中107pt配賦後に意図して残した将来MS用バッファ。未配賦ptは報酬債務を発生させず、保存停止条件ではない。
- 支払分類の唯一の根拠は `members.exclude_from_payout_notice`。`is_officer` は使わない。あき・りりは非役員だが支払対象外。
- AMD運営費30% + クローザー報酬5%は65%PJ予算の外側。`companyReserveYen` は35%ではなく、65%枠内で支払対象外メンバーへ割り当たった非現金配賦の互換フィールド名。UIは「対象外配賦」と表示する。
- 同じ旧バグはSX固有ではなくZMP/CXにもあった。SXはstockが9か月連続で残り重複が最大化し、予算順の先頭PJだけが自動展開されるUIだったため、SXだけに見えた。全PJのshared backend pathを監査する。
- 今回はDB・支払・報酬データを変更していない。
- worktreeはroot 1件のみ。旧detached `b108` はclean/main-contained確認とローカルアーカイブ後に削除済み。
- closeout時に見つかったW-Prep拡張7日窓の別差分は、owner taskが8文書を同期して `f936e278` としてmain・productionへ反映済み。SX差分とはcommitを分離した。

## 次タスク

1. 開始時に `git status -sb --untracked-files=all`、`git rev-parse HEAD`、`git rev-parse origin/main`、`git worktree list --porcelain`、`curl -fsS https://amd-os-pwa.vercel.app/api/build-info` をread-onlyで確認する。
2. SXで再発報告がなければ追加実装しない。13ptを埋めない、35%をPJ予算へ入れない、役員フラグへ戻さない。
3. 再発時は `/api/admin/ms-overview/<planCycleId>` の `budgetImpact` と全月reward summaryを確認する。対象外配賦は各月のfunded `companyReserveYen`だけを合計し、`stockYen`は支払対象メンバーの最終月残だけを期末未払へ1回入れる。
4. SXだけを開いて判断せず、ZMP/CX/KUTEを含む全plan cycleを同じshared functionで横断監査する。UIで閉じたPJや未展開PJを正常の証拠にしない。
5. 今後shared checkoutに別taskのdirtyがあっても、ownerを特定して返し、SX commitへstage/revertしない。

## 確立済みの運用ルール

- main一本。新branch/worktreeを作らない。dirtyを理由にbranchを切らない。
- 既存dirtyは戻さず、今回の対象ファイルだけを明示stageする。`git add .` / `git add -A`は禁止。
- finance修正は、共通ルール→repo/pwaルール→design/manual正本→実装→live DB/APIの順で確認する。
- `stockYen` は月末残高。月次フローと期間合計しない。対象外配賦は `fundedNonCashAllocationYen()`、外部期末未払は `externalUnpaidStockYen()` の共通helperを使う。
- `exclude_from_payout_notice=true` のメンバーも65% cap按分には参加し、現金支払だけ0にする。shareを消したり他メンバーへ再配分しない。
- 仕様変更時はdesign、該当OS manual章、manual changelog、回帰検査、development design_logを同じ実装単位で同期する。
- PWA本番反映は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`。直接 `npx vercel` や生のpushを使わない。
- コードを変える場合はbuild versionをpatch bumpし、対象unit、`npm run test:critical-ui`、`npx tsc --noEmit`、`npm run build`、production `/api/build-info`を確認する。
- DB/payment mutationは別の明示依頼がない限り行わない。金額を直すために本番報酬行を書き換えない。

## 今回の検証

- `npm run test:cockpit-season-finance-reserve`: PASS
- `npm run test:ms-overview-reward-reserve`: PASS
- `npm run test:critical-ui`: PASS
- `npx tsc --noEmit`: PASS
- `npm run build`: PASS
- production実データでSXの `MS編集停止中` 消失、対象外配賦3,085,723円、残予算613,525円、期末未払0円を確認。
- 390px幅のadmin画面には既存wide-layout由来の横クリップがあるが、今回の計算/ラベル修正起因ではない。別UI課題として扱う。
```
