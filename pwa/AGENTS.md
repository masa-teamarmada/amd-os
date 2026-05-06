まず必ず以下の共通ルールを読む。

@/Users/masa/projects/AGENTS.common.md

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

AMD OS 全体の構成・Supabase 正本・各クライアントの役割は `/Users/masa/projects/amd-os/AGENTS.md` に従う。

# AMD OS PWA — 入口

**まず `pwa/SPEC_pwa.md` を読む** (画面・データモデル・cron・運用コマンドの正本)。次に `pwa/HANDOFF_pwa_rebuild.md` で直近の状態と次の一手を確認。固有の運用ルール (デプロイコマンド・DDL 適用) は `pwa/CLAUDE.md`、バグ・教訓は `pwa/BUGS.md`、過去セッションログは `pwa/design_log/sessions_YYYY-MM.md`。

# 確認方針 (PWA は常に本番)

**開発中の動作確認は常に本番環境で行う。** `npm run dev` のローカル確認は基本やらない (まさが手元で見るのは本番デプロイ後の URL)。

標準ワークフロー: 実装 → `tsc --noEmit` 通過 → commit → push → main に merge → `npx vercel --prod --yes --cwd /Users/masa/projects/AMD/amd-os/pwa` → 本番 URL で目視確認。

**えいみへの含意**: まさからの確認待ちで止まらず、tsc が通ったら commit/push/deploy まで一気に通す。確認質問が連続して時間を溶かすほうが損失が大きい。本番反映後の見た目で「ここ違う」と言われたら直す、のループの方が速い。
