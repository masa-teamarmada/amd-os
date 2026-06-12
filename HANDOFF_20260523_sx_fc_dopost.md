# HANDOFF - SX/FC MTG結果 + pwaApi POST対応 + 「会話→正本md昇格」設計

- Last updated: 2026-05-23
- Topic: 2026-05-22 FCとのMTG結果を knowledge/sx.md とコックピットMTGサマリと SX Slack に整理して反映。pwaApi POST 対応で長文1投稿可能に。「会話→正本md昇格」設計md を新規作成
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- HEAD at handoff: `21e4df5` (origin/main 同期済み、working tree clean)
- 私の作業の主 commit: `3ecf569 feat(gas): pwaApi runFunc を POST body 経由で叩けるようにする + 関連ドキュメント整備` (HANDOFF_20260523_sx_fc_dopost.md / gas/80_SlackWebhook.js / gas/CLAUDE.md / gas/DEBUG.md の 4 ファイル)
- `pwa/design/su_knowledge_promotion_loop.md` と `pwa/design_log/sessions_2026-05.md #30` は別人セッションの commit (77aa1b4 / fd56582 / 9ff32b8) に混ざる形で push 済み (working tree から消えてるので OK)
- ※ 既存 `HANDOFF.md` (2026-05-17 OS生データ差分レビュー Codex主導化セッション) は別件として残してある。私の今日のセッション分はこの新ファイル参照

## Summary (3-10 行)

- 2026-05-22 FCとのMTG (八重洲) で出た 4 方面の拡張機会 (キャッシュ=FC北陸メッキ排水 / 国策1=閉鎖鉱山レアアース廃水 / 国策2=南鳥島レアアース＋下水道19元素 / アップサイド=ペロブスカイト鉛リサイクル) を `knowledge/sx.md` に「2026-05-22 拡張機会の発見」セクションとして追記。発生源の流れ (JAFCO 発→FC見正氏波及) と新規論点 (塩水耐性品種改良＋国費獲得仮説 / GMO規制 / シアノ酸素耐性 / 担持前提 / CEO問題) も整理
- PJコックピット MTGサマリ (Supabase `project_meeting_summaries`) を Supabase REST 直叩きで手動 upsert。チーム共有用 (knowledge/ は個人 dir で見えないため)
- SX Slack `#p21_sx` につくよみ名義で 1 投稿に統合 (ts: 1779539254.928589)、コックピット MTGサマリへの誘導 URL 付き
- `pwa/design/su_knowledge_promotion_loop.md` を新規作成: Personal OS Loop の C-2 を SU 知識領域に拡張する姉妹設計 (KAGAMI ではなく amd-os 配下、まさ判断)
- `pwa/design_log/sessions_2026-05.md` の `#30` に詳細記録
- 副成果: pwaApi runFunc を POST body 経由で叩けるよう `80_SlackWebhook.js` の doPost に pwaApi 分岐追加、`clasp deploy v1472` で本番反映。GAS Web App 8KB URL制限を回避できるルートを `gas/CLAUDE.md` に正本化 (「Slack 投稿」「Supabase REST 直叩き」セクション新規追加)

## Repo State

- HEAD: `155054f feat(pwa): rewrite cockpit to case-C layout`
- 私が今日触ったファイル (commit 推奨):
  - `gas/80_SlackWebhook.js` (M): doPost 冒頭に `if (mode === "pwaApi") return doGet(e);` 追加
  - `gas/CLAUDE.md` (M): POST 経由 node fetch 例 / Slack 投稿セクション / Supabase REST 直叩きセクション追記
  - `gas/DEBUG.md` (M): 2026-05-23 教訓 3 件追記 (pwaApi POST対応 / SLACK_BOT_TOKEN 2種 / clasp v3 互換)
  - `pwa/design/su_knowledge_promotion_loop.md` (??): 新規作成
  - `pwa/design_log/sessions_2026-05.md` (M): #30 追記
- 別人 / 別セッションが触ってる未コミット (私は触ってない、巻き戻さない):
  - `pwa/design/meeting_summaries.md`, `pwa/package*.json`, `pwa/src/components/cockpit/CockpitMeetingSummary.tsx`, `pwa/src/components/hud/HudCockpitMeetingSummary.tsx`, `pwa/src/components/cockpit/CockpitMeetingDetailModal.tsx`, `pwa/src/components/cockpit/MarkdownView.tsx`, `pwa/src/components/hud/HudCockpitMeetingDetailModal.tsx`, `tmp/`
- `knowledge/sx.md` は別 git 外 (`/Users/masa/projects/knowledge/` は git 管理外)。md 直接編集で完結
- GAS deploy v1472 反映済み: `AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G` (PWA `NEXT_PUBLIC_GAS_WEBAPP_URL` で本番使用中)
- `~/.clasprc.json` を fresh login で再生成 (旧版は `~/.clasprc.json.bak-20260523` に退避)

## Open Tasks (未解決)

- **`su_knowledge_promotion_loop.md` Phase 1 実装はまだ着手前** (migration + Supabase seed + admin UI + 抽出 cron + えいみ promote skill)。次の amd-os セッションで Phase 1 から段階着手
- **5/27 三菱総研・プラチナ構想ネットワーク面談** (午前) → Calendar event 未登録 (FC側のセッティング待ち)。SX 側 5/27 16:00 SX定例MTG (taku 主催, calendar event `5gnivrdogk1hreu8ni8lkqbe54_20260527T070000Z`) は既存
- **次回 SX 定例 (5/27 16:00) 議題**: GMO規制・閉鎖系プロセス本格議論 / シアノ酸素耐性の正確な値 / 担持前提への所見 (杉浦先生確認) / 流動層リアクター×ビーズ固定化 (中島先生・佐竹氏ラインと擦り合わせ) / CEO問題暫定スタンス合意 — `knowledge/sx.md`「2026-05-22 拡張機会の発見」セクション参照
- **塩水耐性シアノ品種改良 → 国費獲得仮説**: 杉浦先生に育種パス確認後、JOGMEC / NEDOグリーンイノベーション基金 / SBIR 推進プログラムへの提案ストーリー組み立て (まさ案、未着手)
- **テスト投稿時に Slack 投稿マニュアル化**: `gas/CLAUDE.md`「Slack 投稿」セクションに既に追記済みだが、運用してみて不足あれば追加

## First Action Next Session

1. このファイル + `pwa/design/su_knowledge_promotion_loop.md` を読む
2. `gas/DEBUG.md` 2026-05-23 セクション 3 件を読む (POST対応 / SLACK_BOT_TOKEN 2種の罠 / clasp v3 互換)
3. `gas/CLAUDE.md` 新規セクション (POST 経由 / Slack 投稿 / Supabase REST 直叩き) を確認
4. **次にやるなら**:
   - (実装路線) `su_knowledge_promotion_loop.md` Phase 1: migration 4 テーブル (`su_knowledge` / `su_knowledge_extracts` / `su_knowledge_promotions` / `su_knowledge_changelog`) 作成 → `knowledge/{su}.md` 全件 Supabase seed
   - (SX 路線) 5/27 三菱総研MTG前に塩水耐性シアノ品種改良の前準備 / 杉浦先生確認準備 / CEO 暫定スタンスチーム合意
   - (片付け路線) 私の未コミット 5 ファイル を `feat(gas)+(docs): pwaApi POST 対応と SU knowledge ループ設計` で 1 コミットに

## Pointers

- 設計の正本: `pwa/design/su_knowledge_promotion_loop.md` (今回新規) / `pwa/design/L2_DATA.md` / `pwa/design/meeting_summaries.md`
- 関連バグ・教訓: `gas/DEBUG.md` 2026-05-23 (3 件)
- 開発手順: `gas/CLAUDE.md`「GAS 関数を CLI/curl から実行する手順」「Slack 投稿」「Supabase REST 直叩き」
- 設計ログ: `pwa/design_log/sessions_2026-05.md` #30
- 個人 dir: `/Users/masa/projects/knowledge/sx.md`「2026-05-22 拡張機会の発見」セクション
- 既存 (5/17) 別件 handoff: `HANDOFF.md` (Codex automation / L2拡張 / Atlas停止/移管 / CTB凍結履歴)

## Verification Commands Run This Session

```bash
# pwaApi POST 動作確認 (deploy v1472 後)
node -e 'fetch(URL+"?mode=pwaApi&key="+KEY+"&action=runFunc", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({fn:"slackNotifyGetProjectChannelId_", args:["p21"]})}).then(r=>r.text()).then(console.log)'
# → {"ok":true,"data":{"fn":"slackNotifyGetProjectChannelId_","ms":620,"result":"C093DQ4D04W"}}

# Supabase REST 直叩き upsert (project_meeting_summaries 手動編集)
curl -sL -X POST "$SUPABASE_URL/rest/v1/project_meeting_summaries?on_conflict=meeting_id" \
  -H "apikey: $SRK" -H "Authorization: Bearer $SRK" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates,return=representation" \
  --data-binary @/tmp/sx_mtg_upsert.json

# Slack 投稿 (つくよみ名義)
node -e 'fetch(URL+"?mode=pwaApi&key="+KEY+"&action=runFunc", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({fn:"slackNotifyPostToChannel_", args:["C093DQ4D04W", {text:"..."}]})}).then(r=>r.text()).then(console.log)'

# clasp push + deploy
cd /Users/masa/projects/AMD/amd-os/gas
PATH="/Users/masa/.local/node-current/bin:$PATH" npx -y @google/clasp@latest push
PATH="/Users/masa/.local/node-current/bin:$PATH" npx -y @google/clasp@latest deploy \
  --deploymentId AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G \
  --description "v1472_pwaApi_doPost_via_slack_webhook"
```
