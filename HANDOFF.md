# AMD OS Handoff

最終更新: 2026-08-05 JST

対象: SolvioraX（p21）週次管制／全体ガント

作業種別: 開発・受入確認・運用文書更新

## 今回の到達点

- 全体ガントは事業開発／技術開発／組織開発の3レーンだけで運用する。最上位タスクは、NewCo設立の2つの前提MSから逆算した9件だけ。詳細作業は子タスクとして後から足す。
- MSは「有償PoCの口頭合意を確認する」（事業開発全体）と「出資の口頭合意を確認する」（組織開発全体）の2件だけ。独立した「設立前提」レーンや、全MSへのゲート表示は作らない。
- 関係先は `全関係先 / PoC候補先 / VC` を同じ台帳のタブで切り替える。1社1行・9列の直接編集で、進捗のrailだけが閲覧専用履歴を開く。編集のための二重モーダルは作らない。
- 保存済み依存線は、desktopの通常モードでhoverするとその線だけを強調し、近くの`外す`で直接解除できる。接続モード中は解除UIを出さず、mobile/keyboardは依存関係一覧から同じ解除に到達する。
- 依存線は接続元バー右端中央から接続先バー左端中央（MSは◇中心）へ接する。端点の横逃がしは通常11px、迂回時は始点5px・終点4px。タスクバーは10px。

## 正本と現在地

- 実装の主要commit: `d42cad4 fix(sx): simplify dependency line controls`（build `v3.57.22`）。desktopのhover解除、390px横あふれなし、console errorなしを本番で確認済み。
- 現在の`origin/main`には、上記の後に別作業の立替申請改善 `dd21564`（build `v3.57.23`）が入っている。このhandoff・文書整合は同じmainへ続けて保存する。次セッション開始時は必ず`git fetch origin`と`/api/build-info`を取り直す。
- 正式なローカルcheckout `/Users/masa/projects/AMD/amd-os` には、BZMとProject Shareの別作業差分がある。今回のSX作業では変更しない。次セッションで無断pull・reset・checkoutをしない。
- 一時clone `/tmp/sx-schedule-1fHXQm/amd-os` はこのcloseout後に削除する。再開は正式checkoutがcleanになってから、またはmainのclean cloneを明示的に作って行う。

## 検証済み

```text
npm run test:sx-gantt-dependency-route
npm run test:sx-gantt-ui-contracts
npm run test:sx-weekly-control
npx eslint src/components/project-workspace/SxUnifiedTimeline.tsx src/lib/sx-gantt-dependency-route.ts
npx tsc --noEmit
npm run build
npm run test:critical-ui
```

上の全コマンドは依存線変更時点で成功。今回の文書更新後もbuild・型検査・SX契約テストを再実行してからpush/deployする。

## 次セッションで最初にすること

1. `/Users/masa/projects/AGENTS.common.md`から指示書を読み、次に`AGENTS.md`、`CLAUDE.md`、`pwa/AGENTS.md`、`pwa/CLAUDE.md`を読む。
2. `SESSION_MIGRATION_PROMPT.md`の開始確認をそのまま実行し、main・production・ローカルcheckoutの状態を分けて報告する。
3. `pwa/manual/2-3-pj-cockpit.md`、`pwa/spec/3-16-project-weekly-control-current-spec.md`、`pwa/design/FEATURE_REGISTRY.md`、`pwa/BUGS.md`、`pwa/design_log/sessions_2026-08.md`を読んでから、まさの次の具体的な指示に進む。
4. UI変更では、情報密度・直接操作・二重モーダルなし・3レーン・固定ヘッダーを壊さない。まさに明白なUX不具合を発見させないため、実装前後に独立したUI/UX監査を入れる。

## 未解決

今回の受入範囲に未解決の実装はない。次に何を改善するかは、まさの新しい指示を待つ。

## 参照先

- 現行マニュアル: `pwa/manual/2-3-pj-cockpit.md`
- 現行仕様: `pwa/spec/3-16-project-weekly-control-current-spec.md`
- 機能台帳: `pwa/design/FEATURE_REGISTRY.md`
- 実装: `pwa/src/components/project-workspace/SxUnifiedTimeline.tsx`
- 経路計算: `pwa/src/lib/sx-gantt-dependency-route.ts`
- 引き継ぎプロンプト: `SESSION_MIGRATION_PROMPT.md`
