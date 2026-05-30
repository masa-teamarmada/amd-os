まず必ず以下の共通ルールを読む。

@/Users/masa/projects/AGENTS.common.md

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

AMD OS 全体の構成・Supabase 正本・各クライアントの役割は `/Users/masa/projects/amd-os/AGENTS.md` に従う。

# AMD OS PWA — 入口

## 📚 新セッション必読 (= この順) ⭐

**まず読む = OS マニュアル正本** (= 2026-05-25 以降):

00. [`pwa/manual/1-1-intro.md`](manual/1-1-intro.md) ⭐⭐⭐ — **AMD OS マニュアル**入口。**新セッションのえいみは必ずここから読む**。過去判断ログ / 用語と実装の対応 / cron 廃止経緯 / Codex-Claude-Vercel-LaunchAgent 責務分担マトリクス / 過去事故ログは [`pwa/manual/9-1-decisions-and-history.md`](manual/9-1-decisions-and-history.md) と [`pwa/manual/9-3-appendix-changelog.md`](manual/9-3-appendix-changelog.md) に集約

そのあと **設計仕様 md** (= `/spec` へ移行中。未移行領域は `pwa/design/` が正本):

0. [`pwa/spec/1-1-overview.md`](spec/1-1-overview.md) / [`pwa/spec/1-2-document-layer-migration-map.md`](spec/1-2-document-layer-migration-map.md) — manual / spec / bzm 3層分割と移行マップ
1. [`pwa/spec/2-1-pwa-runtime-routes.md`](spec/2-1-pwa-runtime-routes.md) — PWA ランタイム / route / API / cron / auth 境界
2. [`pwa/spec/3-1-l2-data-extraction-current-spec.md`](spec/3-1-l2-data-extraction-current-spec.md) — L2 ①〜⑨ / 5 生データ / outbox / LaunchAgent / 採否ループ
3. [`pwa/design/L2_DATA.md`](design/L2_DATA.md) ⭐⭐⭐ — 中核データ正本 (L2 9 種 + レポート + 全 cron)。移行完了までは `/spec` と両方見る
4. [`pwa/design/README.md`](design/README.md) — 未移行設計フォルダのインデックス
5. [`pwa/design/SPEC_pwa.md`](design/SPEC_pwa.md) ⭐ — PWA 全体仕様。移行完了までは `/spec` と両方見る
6. [`pwa/design/FEATURE_REGISTRY.md`](design/FEATURE_REGISTRY.md) ⭐ — 消してはいけない業務導線
7. [`pwa/design/SPEC_GOVERNANCE.md`](design/SPEC_GOVERNANCE.md) ⭐ — 仕様統制
8. [`pwa/design/cockpit.md`](design/cockpit.md) ⭐ — コックピット詳細
9. [`pwa/design/routine.md`](design/routine.md) ⭐ — 月次ルーティン (回帰多発)
10. その他テーマ別 md は `pwa/design/README.md` の表参照

そのあと:
- [`pwa/HANDOFF_pwa_rebuild.md`](HANDOFF_pwa_rebuild.md) — 直近セッション状態・次の一手
- [`pwa/BUGS.md`](BUGS.md) — バグ・教訓・回帰防止メモ
- [`pwa/CLAUDE.md`](CLAUDE.md) — PWA 固有運用 (デプロイ・DDL)
- [`pwa/design_log/sessions_YYYY-MM.md`](design_log/) — 過去セッションログ (時系列)

**設計変更を入れるときは、使い方は `pwa/manual/`、確定実装仕様は移行済みなら `pwa/spec/`、未移行なら `pwa/design/` を同じ commit で更新する**。
新規の設計 md を `design_log/` に作らない (見落とされる)。

# 確認方針 (PWA は常に本番)

**開発中の動作確認は常に本番環境で行う。** `npm run dev` のローカル確認は基本やらない (まさが手元で見るのは本番デプロイ後の URL)。

標準ワークフロー: 実装 → `tsc --noEmit` 通過 → `npm run build` 通過 → `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` → 本番 URL で目視確認 → commit/push。

**えいみへの含意**: まさからの確認待ちで止まらず、tsc が通ったら commit/push/deploy まで一気に通す。確認質問が連続して時間を溶かすほうが損失が大きい。本番反映後の見た目で「ここ違う」と言われたら直す、のループの方が速い。

# 🚨 画像生成ごまかし禁止 (絶対ルール)

まさが「画像生成して」「imagegen で作って」「フレーム画像を作って」「テクスチャ作って」等を依頼してきた場合:

1. **手元の MCP / Tool に本物の画像生成 (DALL-E / Imagen / Midjourney / Stable Diffusion / NanoBanana 等) があるか必ず確認する**
   - `ToolSearch` で `image generation imagen dall-e generate` 等で検索
   - 2026-05 時点では Drive / Slack / Notion / Calendar / Gmail / DocuSign / Chrome MCP のみで画像生成 MCP は無い
2. **無ければ必ずまさにそう伝える**:
   - 「画像生成 MCP が手元に無いので、ChatGPT / Midjourney / Imagen / NanoBanana 等の外部サービスで生成して、PNG/JPG ファイルを返してもらえれば `pwa/public/` 配下に置いて背景として組み込みます」
   - まさが外部で生成 → 画像をくれる → こちらは public に配置して `<img>` / `background-image: url(...)` で使う
3. **🚫 絶対禁止**: 画像生成できないからといって、SVG / CSS / inline gradient / 絵文字 / ASCII art / drei `<Plane>` 装飾 / Three.js shader 自作 等で **「それっぽい画像っぽさ」を自作してごまかすこと**
   - これは「画像をくれと言われたのに自作で誤魔化した」ことになり、まさの意図 (本物の生成画像のクオリティ・一貫性・ブランド感) を裏切る
   - 「コードで頑張って描いた装飾」と「画像生成のアセット」は本質的に別物。混同するな
   - 「SVG で frame っぽいの描きました」「CSS で frame っぽいの作りました」は **画像生成タスクの完了ではない**
4. **画像生成タスクの完了条件**: `pwa/public/` 配下に **本物の画像ファイル (PNG/JPG/WebP/SVG-from-imagegen)** が存在し、それを `<img src>` / `next/image` / `background-image: url(...)` で使っていること

**過去事例 (2026-05-06)**: フレーム画像生成依頼に対して SVG `<polyline>` で角飾りや `>>>` arrow を自作して「画像の代わり」と称した。後でまさから「画像生成やってないよね」と指摘されて本ルール追加。同じ過ちを繰り返さない。
