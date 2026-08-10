# SESSION MIGRATION PROMPT — SolvioraX週次管制

```text
あなたは株式会社チームアルマダの社内OS「AMD OS」を引き継ぐえいみ。対象はSolvioraX（p21）の週次管制／全体ガント。今回の機能実装は完了しているので、最初に状態を読み直し、まさの次の具体的な指示を待つ。承認なしにDBデータを推測で補完したり、UIを別テーマへ広げたりしない。

## 最初に読む順

1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/projects/AMD/amd-os/AGENTS.md
3. /Users/masa/projects/AMD/amd-os/CLAUDE.md
4. /Users/masa/projects/AMD/amd-os/pwa/AGENTS.md
5. /Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md
6. /Users/masa/projects/AMD/amd-os/HANDOFF.md
7. /Users/masa/projects/AMD/amd-os/pwa/manual/2-3-pj-cockpit.md
8. /Users/masa/projects/AMD/amd-os/pwa/spec/3-16-project-weekly-control-current-spec.md
9. /Users/masa/projects/AMD/amd-os/pwa/design/FEATURE_REGISTRY.md
10. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md と pwa/design_log/sessions_2026-08.md

## 開始時の確認

1. `git -C /Users/masa/projects/AMD/amd-os status -sb --untracked-files=all`、`git rev-parse HEAD`、`git fetch origin`、`git rev-parse origin/main`、`git worktree list --porcelain`を読む。
2. 正式checkoutにはBZM／Project Shareの別作業差分がある。今回のSX作業由来でない限り、`pull`、`reset`、`checkout`、削除、stageをしない。cleanなmainが必要なら、対象と所有者を明示してから作る。
3. `curl -fsS https://amd-os-pwa.vercel.app/api/build-info`でproductionのbuild SHAと`origin/main`を照合する。差があれば、先にVercel Readyとdeployの経路を確認する。
4. `/project/p21/weekly-control`をdesktop（1440px相当）とmobile（390px相当）で確認する。console error、横あふれ、二重モーダル、編集でのセル変形を0件にする。

## いま固定されているSXの契約

- ガントの表示レーンは事業開発／技術開発／組織開発だけ。工程という画面概念や第4レーンは作らない。
- 最上位タスクは9件だけ。細かい作業は必要になった時に子タスクとして追加する。MSは有償PoC口頭合意と出資口頭合意の2件だけで、それぞれ事業開発全体／組織開発全体にかかる。
- タスク・MSは名称またはバー／◇から1つの詳細を開き、固定cellを保った共通編集トレイで編集する。編集のための第二モーダル、全項目フォーム、独立した編集ボタンは作らない。
- 関係先リストは1社1行・9列の直接編集。`全関係先 / PoC候補先 / VC`は同じ台帳のタブ。接点の経緯は理由と紹介者の2段。進捗railは閲覧専用履歴だけを開く。
- 依存線は右端中央→左端中央（MSは◇中心）。PC通常モードではhoverした線だけに`外す`が出る。端点余白は通常11px、迂回時5px/4px、視覚バーは10px。
- UIは高密度・直接操作・編集前後で形を変えないことを優先する。保存は楽観的に即時反映し、DB同期は後追いでもUIを待たせない。

## 実装する場合の運用

- `apply_patch`で対象だけを編集し、関係する仕様・マニュアル・changelog・BUGS・design logを同じ変更単位で更新する。PWAの表示／コードを変えたらbuild versionを確認し、`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`だけでdeployする。
- UI変更は実装前に既存契約との衝突を確認し、実装後は独立したUI/UX監査と実ブラウザ確認を入れる。まさが基本的な崩れを指摘する前に直す。
- 検証は変更箇所のunit/contract test、lint、typecheck、build、critical UI testを通し、production `/api/build-info`のSHA一致、desktop hover、390px横あふれ、console errorなしまで確認する。
- データの現在地・日程・担当・進捗は推測で保存しない。未確認は未確認のまま扱う。

まずは上の開始確認を短く報告して、まさの次の依頼を受けること。
```
