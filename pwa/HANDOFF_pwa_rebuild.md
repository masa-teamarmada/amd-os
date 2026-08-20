# HANDOFF - AMD OS PWA

- 更新: 2026-08-20 JST
- セッション: 左ナビ「ホーム」のアクティブPJから、コックピット／ワークスペースを選ぶ二段フライアウト
- 作業種別: development

## 現在地

- 製品実装は `f7745b99 feat(pwa): add project surface flyout`。`main` へ反映済み。
- 本番は `https://amd-os-pwa.vercel.app`。確認済み build は `v3.83.12`、実装commitのSHAは `f7745b99c138ca8874c3f561c694aa0dcee90d03`。
- `GlobalNav.tsx` のホームhoverでアクティブPJ一覧を出し、各PJをhover/focusすると右側にPJ名・「コックピット」・「ワークスペース」を表示する。Chromeのブックマークフォルダ式で、PJ行自身は遷移しない。
- 子メニューの遷移先は `/project/:projectId/cockpit` と `/project/:projectId/workspace`。menu間の移動で閉じないようclose timerを使い、画面端では位置をclampする。
- ログイン済み外部Chromeの本番画面で、`p00` の両方の遷移を実操作確認済み。コンソールエラーなし。ローカルの未ログインブラウザは本番UI検証の根拠にしない。

## 検証

- `npm run test:critical-ui`
- `npm run test:portfolio-home-contract`
- `npx eslint src/components/nav/GlobalNav.tsx`
- `npx tsc --noEmit`
- `npm run build`（既知の動的filesystem warningのみ）
- 本番 `/api/build-info` と、外部Chromeでのhover・両遷移を確認

## 未解決

なし。新しい要望が来たら、その要望を開始点にする。

## 次の最初の行動

ナビを変更する場合は、まず `GlobalNav.tsx`、`design/FEATURE_REGISTRY.md`、`spec/2-2-pwa-surface-inventory-current-spec.md`、`manual/2-1-member-quick-start.md` を読む。実装後はログイン済み外部Chromeで、PJ一覧→子メニュー→両導線まで確認する。

## 参照先

- 実装: `pwa/src/components/nav/GlobalNav.tsx`
- UI正本: `pwa/design/FEATURE_REGISTRY.md`
- PWA画面仕様: `pwa/spec/2-2-pwa-surface-inventory-current-spec.md`
- 利用者マニュアル: `pwa/manual/2-1-member-quick-start.md`
- 開発履歴: `pwa/design_log/sessions_2026-08.md`
- バグ・教訓: `pwa/BUGS.md`
