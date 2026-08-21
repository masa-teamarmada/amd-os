# HANDOFF - AMD OS PWA

- 更新: 2026-08-22 JST
- セッション: 事業計画タブの全PJ常設化 → 月次試算表・年次計画の移設
- 作業種別: development

## 現在地

- このセッションの実装は2commitとも `main` に載り、本番反映まで完了している。
  1. `a92d4510` — 事業計画タブを**全PJ常設**に変更。フェーズ表と年次試算表は p21 固有なのでSXのときだけ足す。資本政策プラン (`CapitalPlanWorkspace`) の正本を会社概要タブから事業計画タブへ移動。
  2. `f8effee8` / v3.88.3 — スコア詳細タブにあった「イベントと月次試算表」と「年度別の事業・資金推移」を事業計画タブへ移設（`Bzm22TimeLedger` 丸ごと）。pilot payload は `bzm-2-2-pilot-client.ts` の共有キャッシュで両タブが1回だけ取得する。
- 前提の訂正: 事業計画タブは 2026-07-28 に **SX (p21) 専用**として作られたもので、全PJに存在したことは一度もない。まさの「消えた」は記憶違いで、実質の要望として全PJ常設化を実装した。
- BZM 2.2 暫定試算の**対象外PJでは表そのものを出さない**。`Bzm22PilotNotFoundError` → `outOfScope` → `return null`。エラーカードも空表も出さないのが仕様。
- 本番確認は `/api/build-info` の一致に加えて、p21 事業計画／p21 スコア詳細／p10 事業計画の3面をログイン済みChromeで実操作確認済み。
- BUILD_VERSION は複数セッションが並行 bump する。採る前に必ず `src/lib/build-info.ts` の HEAD 値を読む（handoff 時点で他セッションが既に v3.89.1 まで進めている）。

## 検証

- `npx tsc --noEmit` → 自分の変更ぶんエラー0。`src/components/ui/dialog.tsx(57,54)` の TS2345 は別セッションの未コミット差分由来（main上のファイルは健全、Vercel build成功で裏取り）。
- `npm run test:critical-ui` / `npm run test:bzm-2-2-pilot-ui` → ok。`npm run build` 成功。
- push は他セッション dirty があるため `deploy.sh`（clean tree hard-stop）ではなく素の `git push origin main`。対象ファイルのみ列挙して stage、`git add .` は不使用。

## 未解決

- 前セッションから継続の知財台帳の外部同期3件（`pwa/spec/3-19-project-ip-current-spec.md` §5）。①特許庁 特許情報取得API と EPO OPS の利用者登録（申請内容は提出前にまさへ見せる）②`project_ip_deadlines` を `app_notifications` / `proactive_todos` へ配線 ③`/admin/ip` の静的 `IP_REPORT_MD` をp00資産として台帳へ統合。
- 今回の作業由来のブロッカーは無し。このセッションで作った branch / worktree: **none**。

## 作業ツリーの状態（2026-08-22 handoff 時点、他セッション所有）

- staged deletion: `pwa/src/app/api/project/[projectId]/plan-value-check/route.ts` / `pwa/src/lib/project-plan-value.ts` / `pwa/src/types/project-plan-value.ts`
- tracked dirty: `CockpitAmdScoreDetailTab.tsx` / `SeedDetailModal.tsx` / `CurrentSpsAssessmentCard.tsx` / `SpsFormulaPanel.tsx` / `SpsScreeningBandSection.tsx`
- いずれもSPS・シーズ台帳系の別セッション所有。commit・revert・削除しない。
- 未push commit: なし（`git log --branches --not --remotes` 空）。

## 次の最初の行動

コックピットのタブ構成をまた触るなら、`CockpitView.tsx` を読む前に `pwa/spec/3-8-cockpit-current-spec.md` を読む。守る契約は3つ。

1. **全PJ常設のタブに、特定PJだけが持つデータを無条件で置かない。** BZM 2.2 pilot は404が正常系なので、404は「異常」ではなく「非表示」として扱う（`Bzm22PilotNotFoundError`）。同じ形の追加をするときはこのパターンに合わせる。
2. **契約テストのアンカーは消さずに移す。** UIを別コンポーネントへ移設したら `check_pwa_critical_ui.cjs` と該当の `check_*_contract.mts` の `expectIncludes` / `requireIncludes` を新しいホストへ付け替える。消すだけにすると導線の消失を検知できなくなる。
3. **資本政策プランの編集導線は事業計画タブが唯一の正本。** 会社概要タブへ戻さない。

## 参照先

- 事業計画タブ: `pwa/src/components/cockpit/CockpitBusinessPlan.tsx` / `CockpitView.tsx`
- 移設した表: `pwa/src/components/cockpit/Bzm22TimeLedgerSection.tsx`（ホスト） / `Bzm22TimeLedger.tsx`（本体） / `bzm-2-2-pilot-client.ts`（共有キャッシュ）
- スコア詳細タブ: `pwa/src/components/cockpit/Bzm22ProvisionalObservatory.tsx`
- 契約テスト: `pwa/scripts/check_pwa_critical_ui.cjs` / `pwa/scripts/check_bzm_2_2_pilot_ui_contract.mts`
- 設計書: `pwa/spec/3-8-cockpit-current-spec.md` / `pwa/spec/4-2-amd-score-current-spec.md` / `pwa/design/cockpit.md` / `pwa/design/FEATURE_REGISTRY.md` / 変更履歴 `pwa/spec/6-1-appendix-changelog.md`
- 利用者マニュアル: `pwa/manual/2-3-pj-cockpit.md` / 変更履歴 `pwa/manual/9-3-appendix-changelog.md`
- 知財（前セッションの継続課題）: `pwa/spec/3-19-project-ip-current-spec.md` / `pwa/src/components/cockpit/CockpitIpPortfolio.tsx`
- 開発履歴: `pwa/design_log/sessions_2026-08.md`
- バグ・教訓: `pwa/BUGS.md`
