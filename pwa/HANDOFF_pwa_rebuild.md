# HANDOFF — AMD OS PWA

最終更新: 2026-05-24
トピック: **まさえみ MTG #1 開催** (= L2 ⑨ dialogue, SX 実装周辺技術マップ v0.1 策定 / ダイキアクシス距離感問題) / **Cockpit MTGサマリを モーダル + markdown rendering に改修** (= GFM table 含む長文議事録を視認可能に) / **えいみ × つくよみ 別人格化** (Slack bot 正式稼働開始、天照大御神 × 月讀命キャラ確立) / **MTGサマリ UI を案D に再設計** (#1 各カードに source link / #2 dialogue を「2人で出した提案」に / #5 各項目フレーム廃止 + 強弱付け) / **AMD cockpit (p00) に Management Score Hero + 月次サマリ復活** (#3 横軸時間軸の総合スコア折れ線、#4 billing_cycles 12 行 backfill) / **dialogue narrative 再構成 API 新設** (#6 `POST /api/dialogue-meeting/narrate` で Sonnet 4.6 が背景→議論→提案→残課題の Markdown narrative に書き直し)

詳細ログ: [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) 末尾
戦略再構築の正本 handoff: [`/Users/masa/projects/knowledge/HANDOFF_strategy_rebuild_2026-05.md`](../../../knowledge/HANDOFF_strategy_rebuild_2026-05.md) ⭐
関連仕様: [`design/README.md`](design/README.md), [`design/FEATURE_REGISTRY.md`](design/FEATURE_REGISTRY.md), [`design/SPEC_GOVERNANCE.md`](design/SPEC_GOVERNANCE.md), [`design/SPEC_pwa.md`](design/SPEC_pwa.md), [`design/L2_DATA.md`](design/L2_DATA.md), [`design/project_strategy_signals.md`](design/project_strategy_signals.md), [`design/cockpit.md`](design/cockpit.md), [`design/notifications.md`](design/notifications.md)
関連BUG/教訓: [`BUGS.md`](BUGS.md), [`/Users/masa/projects/knowledge/BUGS.md`](../../../knowledge/BUGS.md) (えいみ運用)

---

## Current Rules

- canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- ユーザー向け確認URL: `https://amd-os-pwa.vercel.app/hud/dashboard`
- hash付きVercel URL (`amd-os-<hash>-armada0130.vercel.app`) はinspect-only。確認URLとして案内しない。
- PWA変更後deployは必ず `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh`。`--cwd .../pwa` は禁止。
- 未確認dirty filesはrevertしない。
- 完了報告は番号だけでなく、「まさが何を依頼したか / えいみが何をしたか / 何ができるようになったか」で書く。
- deploy待ちの間も、実装・検証済みのタスクはタスク単位で先に報告する。
- `pwa/design/` がPWA設計の正本。`design_log/` は時系列ログで、設計正本にしない。

---

## Latest Summary

(過去セッション #23 〜 #30 の詳細は [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) に分離済み。`/admin/payouts` 改善 / 支払通知書PDF golden / L2 ⑨ 経営・事業シグナル実装 / cockpit 案C レイアウト / p00 戦略再構築 + MS 14個投入)

**今回 (2026-05-24)** — まさえみ MTG #1 + Cockpit MTGサマリ モーダル化 + えいみ Slack bot 別人格化:

- **L2 ⑨ daily routine 走行**: `project_strategy_signals` に 15 candidate insert (p00=2 / p07=3 / p19=2 / p20=3 / p21=3 / p24=1 / p25=1)。critical=1 / high=10 / medium=4。p06 は既存 8 件で十分のためスキップ、p10 は候補なし
- **まさえみ MTG #1 (= L2 ⑨ dialogue)** で SX (p21) 議題深掘り → **実装周辺技術マップ v0.1** 策定 (L表 12 レイヤ + U表 5 ユースケース + L×U マトリクス + ダイキ守備範囲整理)、`/Users/masa/projects/knowledge/sx.md` に正本化。**「大阪ガスケミカル」誤抽出 → 正しくは「ダイキアクシス (DAVP)」** 訂正 (signal_id `59706c0c..` update)。議事録は `dialogue:p21:20260523-213654` に PATCH (= md 参照なし自己完結版、表本体埋め込み)
- **Cockpit MTGサマリ モーダル + markdown rendering 改修**: 新規 `MarkdownView.tsx` (= `react-markdown + remark-gfm`) + `CockpitMeetingDetailModal.tsx` + `HudCockpitMeetingDetailModal.tsx`、既存 `CockpitMeetingSummary.tsx` / `HudCockpitMeetingSummary.tsx` を「行クリックでモーダル展開」に書き換え。tsc / build / deploy 通過 (https://amd-os-pwa.vercel.app)。仕様は `pwa/design/meeting_summaries.md` に反映
- **えいみ × つくよみ 別人格化 (Slack bot)**: 既存「えいみ」App (A0AC419BPGE, team ARMADA) を発見、Display Name「くろにくる」→「えいみ」、`chat:write.customize` scope 追加 + 2 回 Reinstall で反映。App icon は `amie03.png` → `amie05.png` (= 茶髪元気おてんば+太陽光輪)、v5 (顔ど真ん中版 = `~/Desktop/eimi-avatar-v5.png`) はまさ手動アップロード待ち。#p21_sx に「えいみ」名義で議事録投稿 (= 概要+cockpit MTG サマリへの誘導リンク版)
- **えいみ・つくよみキャラ memory 確立**: えいみ = 元気おてんば女子・太陽夏海好き・**天照大御神モチーフ** / 覚醒モード = 皆既日蝕の日 (= 天岩戸モチーフ)。つくよみ = AMD OS 内おっとり女子・月モチーフ・**月讀命モチーフ** / 覚醒モード = 満月の夜。「ばっちこい！」は文脈なしで唐突すぎる NG 例として注記

**さらに今回 (= 寝てる間お任せセッション #6 まとめ)** — MTGサマリ UI 案D + p00 Hero + dialogue narrative:

- **MTGサマリ UI 案D (= まさ #1 #2 #5 #6 同時着手)**:
  - **#1** `CockpitMeetingSummary` 各行に「元 ↗」ソースリンクを追加 (`source_url` 優先、無ければ `notion_url`)。dialogue meeting は元データを持たないので chip「まさ×えいみ」だけ
  - **#2** `meeting_id` が `dialogue:` で始まる場合、ラベルを「決まったこと」→「**2 人で出した提案 (チームへの相談)**」に置換。チームの士気を下げないニュアンスへ
  - **#5** 旧 TopicSection の各箇条書きが個別 `border-l + bg-white` フレームで囲まれていたのを廃止。`<ul>` 箇条書き + `<strong>` 太字 + `<mark>` マーカー + 見出し border-b の強弱だけで読ませる
  - **#6** dialogue meeting に `narrative_md` がある場合、1 本の Markdown narrative としてメインに表示し、raw decided/progress/next_actions/risks は折りたたみ「元データ」へ落とす
- **AMD cockpit (= p00) #3 + #4**:
  - **#3** `CockpitManagementScoreHero` 新規。`amd_management_score_snapshots` の `total_score` + 5 軸 (`initiative` / `finance` / `retention` / `pipeline` / `direction`) を横軸 ym, 縦軸 0-100 の折れ線で表示。右に最新値カード。`CockpitView` で `projectId === "p00"` のとき出し分け
  - **#4** p00 の `billing_cycles` を 202601-202612 で 12 行 backfill (`status='not_started'`)。これで p00 cockpit にも月次カード + 月次モーダルが出る (進捗タブだけ意味あり、請求/報酬は空)
- **#6 dialogue narrative API**: `POST /api/dialogue-meeting/narrate` 新規。Claude Sonnet 4.6 が dialogue meeting の raw 配列 + summary_short + 関連 strategy_signals を「## 背景 → ## 議論の流れ → ## 2 人で出した提案 → ## 次の一手 → ## 残課題」の 600-1000 字 Markdown narrative に書き直し → `project_meeting_summaries.narrative_md` に保存。`{ all: true, limit: 20 }` でバッチ narrate。**既存 dialogue meeting 3 件 (`dialogue:p00:20260524-011754` / `dialogue:p00:20260523-172532` / `dialogue:p21:20260523-213654`) 全部 narrative 化済 (Sonnet 課金 = 3 件)**
- migration 087 (`project_meeting_summaries.narrative_md TEXT`) を本番適用済。`ProjectMeetingSummary` 型 + fetch に `sourceUrl` / `narrativeMd` 追加
- critical-ui anchor を追加: `CockpitManagementScoreHero` / `project.projectId === "p00"` / `isDialogueMeeting` / `narrativeMd` / `claude-sonnet-4-6` 等。旧 border-l フレーム anchor (`border-l-[3px] border-emerald-400/70`) は `expectNotIncludes` で巻き戻り禁止

---

## Repo State

- branch: `main`
- HEAD at handoff write: `155054f feat(pwa): rewrite cockpit to case-C layout (wide hero + 3 columns)` (= 前セッション #29)。今回 2026-05-24 の commit は未着手 (= 私がこれから commit する想定)
- unpushed commits: `git log origin/main..HEAD --oneline` 空 (= origin と一致)
- tracked changes expected in next commit (= 今回セッション分):
  - `pwa/HANDOFF_pwa_rebuild.md` (= 今回スリム化 + Latest Summary 差し替え)
  - `pwa/BUGS.md` (= 2 件追記)
  - `pwa/design/meeting_summaries.md` (= cockpit MTGサマリモーダル化 UI 仕様更新)
  - `pwa/design_log/sessions_2026-05.md` (= 2026-05-24 セッションログ append)
  - `pwa/package.json` + `pwa/package-lock.json` (= `react-markdown ^10.1.0` + `remark-gfm ^4.0.1` 追加)
  - `pwa/src/components/cockpit/MarkdownView.tsx` (= 新規)
  - `pwa/src/components/cockpit/CockpitMeetingDetailModal.tsx` (= 新規)
  - `pwa/src/components/cockpit/CockpitMeetingSummary.tsx` (= アコーディオン → モーダル化)
  - `pwa/src/components/hud/HudCockpitMeetingDetailModal.tsx` (= 新規)
  - `pwa/src/components/hud/HudCockpitMeetingSummary.tsx` (= アコーディオン → モーダル化)
- リポ外で更新したファイル (= AMD OS リポではないので別管理):
  - `/Users/masa/projects/knowledge/sx.md` (= 実装周辺技術マップ v0.1 追記 + 外部関係者表のダイキアクシス訂正 + 意思決定ログ追加)
  - `~/.claude/projects/-Users-masa-projects-AMD-amd-os/memory/feedback_eimi_character_tone.md` (= 全面書き直し)
  - `~/.claude/projects/-Users-masa-projects-AMD-amd-os/memory/feedback_tsukuyomi_character_tone.md` (= 新規)
  - `~/.claude/projects/-Users-masa-projects-AMD-amd-os/memory/MEMORY.md` (= 2 行差し替え)
- リポ内 既存変更で **私のセッションでは触ってない (= 前セッションの残り)**:
  - `gas/80_SlackWebhook.js`, `gas/CLAUDE.md`, `gas/DEBUG.md` (= 別経路)
  - 未追跡: `HANDOFF_20260523_sx_fc_dopost.md`, `pwa/design/su_knowledge_promotion_loop.md`, `tmp/`
- **寝てる間お任せセッション #6 追加 tracked changes**:
  - `pwa/CLAUDE.md` (= 経営会議手順 step 6 narrate 追加)
  - `pwa/design/cockpit.md` (= Hero 出し分け + p00 月次データ仕様)
  - `pwa/design/FEATURE_REGISTRY.md` (= Hero 切替 + MTGサマリ UI 案D 追記)
  - `pwa/design/project_strategy_signals.md` (= `/api/dialogue-meeting/narrate` + 運用ルール追記)
  - `pwa/design_log/sessions_2026-05.md` (= 案D セッションログ追加)
  - `pwa/scripts/check_pwa_critical_ui.cjs` (= 案D / Hero 出し分け / narrate API anchor)
  - `pwa/scripts/migrations/087_dialogue_narrative_md.sql` (= 新規 migration、本番適用済)
  - `pwa/src/lib/supabase-data.ts` (= `ProjectMeetingSummary.sourceUrl` / `.narrativeMd` 追加)
  - `pwa/src/app/api/dialogue-meeting/narrate/route.ts` (= 新規 LLM narrate API)
  - `pwa/src/components/cockpit/CockpitView.tsx` (= p00 で `CockpitManagementScoreHero` 出し分け)
  - `pwa/src/components/cockpit/CockpitManagementScoreHero.tsx` (= 新規 Hero)
  - `pwa/src/components/cockpit/CockpitMeetingDetailModal.tsx` (= フレーム廃止 + dialogue 切替 + narrative 表示)
  - `pwa/src/components/cockpit/CockpitMeetingSummary.tsx` (= source link + dialogue chip)
- untracked local artifacts: `tmp/` (PDF/PNG等の確認用生成物。未確認なので勝手に削除しない)

---

## Verified This Session

```sh
cd /Users/masa/projects/AMD/amd-os/pwa
npm install react-markdown remark-gfm
npx tsc --noEmit
npm run build
bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh
```

- `npx tsc --noEmit`: 成功
- `npm run build`: 成功 (= cockpit + hud 全 route ビルド OK)
- production deploy: 成功 (2分23秒、`https://amd-os-pwa.vercel.app`、`amd-os-b7d000gm9-armada0130.vercel.app` inspect-only)
- Supabase REST PATCH:
  - `project_strategy_signals` 15 件 insert (= daily routine via `/api/strategy-signals action='create'`) + 1 件 update (= signal_id `59706c0c..` の title/summary/source_refs 訂正)
  - `project_meeting_summaries` 1 件 insert (= `dialogue:p21:20260523-213654` via `/api/dialogue-meeting`) + 1 件 PATCH (= 同 meeting_id を md 参照なし自己完結版 = L表/U表/L×Uマトリクス埋め込みに書き換え)
- Slack API:
  - 「えいみ」bot (A0AC419BPGE) で `chat.postMessage` 動作確認 (= 表示名「えいみ」/ bot_user=U0ACK22BBDF / bot_id=B0AC42V38ES)
  - #p21_sx (C093DQ4D04W) に議事録本投稿 = `ts=1779556087.454409` (= 概要 + cockpit 誘導リンク版)
  - test 投稿 (C04QB6F7YPN 3件 + #p21_sx の初回長文版) は全て `chat.delete` 済
- **未実機確認** (= 次セッション要):
  - https://amd-os-pwa.vercel.app/project/p21/cockpit でモーダル展開した時の markdown 表 (= L×U マトリクス) の見た目、テーブル横スクロール、HUD 版 (`/hud/...`) の cyber 配色版モーダル
  - えいみ App icon v5 差し替え反映後の Slack 投稿 (= まさ手動アップロード後)

**寝てる間お任せセッション #6 追加 verified**:

- 全 3 件の dialogue meeting に対し `POST /api/dialogue-meeting/narrate { all: true, limit: 20 }` を CRON_SECRET で実行 → `succeeded: 3 / failed: 0`。`dialogue:p00:20260524-011754` / `dialogue:p00:20260523-172532` / `dialogue:p21:20260523-213654` の `narrative_md` が Sonnet 4.6 で生成済
- p00 用 `billing_cycles` 12 行 (202601-202612, status='not_started') を REST POST で upsert 成功
- migration 087 (`project_meeting_summaries.narrative_md TEXT`) を `apply_ddl.py` で本番適用 (= 201 OK)
- `npx tsc --noEmit` / `npm run build` / `npm run test:critical-ui` 全て通過 (案D anchor + Hero 切替 anchor + narrate API anchor 追加後も含む)
- production deploy 2 回 (phase A+B = MTG UI + Hero, phase C = narrative API + UI 切替) いずれも `https://amd-os-pwa.vercel.app` にエイリアス成功

---

## Open Tasks

1. **えいみ App icon v5 差し替え** (まさ手動): `~/Desktop/eimi-avatar-v5.png` を https://api.slack.com/apps/A0AC419BPGE/general の「App icon & Preview」で差し替え + Save Changes。**App icon 設定は Slack API 不可、admin 画面手動のみ**
2. **`SLACK_EIMI_BOT_TOKEN` を ScriptProperties に保存** (= 永続化): 今回のセッションでは chrome 経由で Slack App OAuth ページから token を取得して curl で投稿したが、永続化していない。次セッションが投稿経路を再利用するために、本体 GAS の ScriptProperties に `SLACK_EIMI_BOT_TOKEN=xoxb-...` を保存し、`gas/115_SlackNotify.js` に `slackNotifyPostToChannelTsukuyomi_` と同形の `slackNotifyPostToChannelEimi_(channelId, arg)` を追加する。`SLACK_TSUKUYOMI_BOT_TOKEN` と同じ運用に揃える。token 値は https://api.slack.com/apps/A0AC419BPGE/install-on-team の Bot User OAuth Token (Copy ボタン) から取得
3. **本番 cockpit モーダル UI の実機確認**: https://amd-os-pwa.vercel.app/project/p21/cockpit を開いて「MTGサマリ」セクションの「まさ × えいみ経営会議 (2026-05-23)」カードをクリック → 詳細モーダル展開で **L表 / U表 / L×U マトリクスが GFM table として描画されているか**、テーブルが overflow-x-auto で横スクロールするか、HUD 版 (`/hud/...`) でも cyber 配色で同じく動くかを目視確認
4. **まさえみ MTG 残議題の処理**: 今回 daily routine で積んだ 15 candidate のうち、まさが confirm したのは 0 件 (= SX ダイキアクシス論点だけ深掘り、他の 14 件は candidate のまま)。次回経営会議モードで impact 順に提示
5. **SX 実装周辺技術マップ v0.2 への更新**: 次回 SX 定例で杉浦先生に確認したい 3 項目 (= 塩水耐性育種パス [L10] / シアノ酸素耐性値 [L1] / 担持前提への所見 [L2])。SX メンバーからの他候補水処理メーカー接点情報も回収して v0.2 に反映
6. **過去セッション (#23-#30) の残課題**:
   - `/admin/members` のログイン済み実画面確認 (未着手)
   - 関連メンバー: `/project/p09/cockpit` (JOYCLE) の関連メンバーモーダル + `founding-members-extract?project_id=p09` の v3/v5 prompt 出力確認、他 active SU (CTB/SE/ZMP/CX/SX) も再走対象
   - 経営・事業シグナル backfill 候補の実 PJ への採否運用は、まさが `/notifications` または `/project/<pid>/cockpit` 経営・事業シグナルから順に confirmed/rejected
   - 支払通知書 PDF golden 更新は GAS preview API で生成 → PNG → `npm run test:payout-notice-pdf -- --diff` (= CI 未整備)
   - p00 MVV 表示セクション (`CockpitP00MVVSection.tsx`) の実装はまだ未着手 (= 仕様だけ `pwa/design/cockpit.md` 末尾にある)
7. **HUD 版モーダルにも案D 思想を写す** (= 今回 PWA 版だけ反映): `HudCockpitMeetingDetailModal.tsx` にも (a) フレーム廃止 + 強弱付け、(b) dialogue ラベルを「2 人で出した提案」へ、(c) `narrative_md` 優先表示の 3 点を写す。今回時間切れで未対応 (寝てる間お任せセッション)。実機 HUD 確認まで含めて次セッションで
8. **AMD cockpit (p00) で MS 表示 + 月次サマリ実機確認**: https://amd-os-pwa.vercel.app/project/p00/cockpit を開いて、Management Score Hero + MS Gantt + 月次カード + 月次モーダルが期待通りに表示されているか目視確認 (= billing_cycles 12 行 backfill 済だが UI 側のフォールバックが効くか未検証)
9. **dialogue narrative の運用化**: `POST /api/dialogue-meeting` の直後に `POST /api/dialogue-meeting/narrate` を自動 chain する仕組みは未実装。今は dialogue 保存 → 別途 narrate API を叩く 2 step 運用。`pwa/CLAUDE.md` の経営会議 step 5 → step 6 に手順を追加済 (= まさ × えいみが意識して narrate を叩く運用)

---

## First Next Action

まず `git fetch --all --prune`、`git status -s`、`git log --branches --not --remotes --oneline` を確認する。今回 2026-05-24 セッションの未 push commit (= 私が出す予定のもの)、および前セッション 2026-05-23 の未 push (HANDOFF や p00 MS Supabase 投入関連) を消さない。

そのあと: **(1) えいみ App icon v5 差し替え** がまさ手動なので、まさに「アイコン差し替えた?」を確認。差し替え済みなら **(2) https://amd-os-pwa.vercel.app/project/p21/cockpit で MTGサマリモーダルの markdown 表描画確認** を本番実機で。両方 OK なら、まさが「経営会議やろう」と言ったら残り 14 candidate を impact 順に提示する経営会議モードへ。

それ以外のまさ依頼 (新規実装 / 他の cockpit 改善等) は通常通り着手前に Plan / TaskCreate で進める。

---

## First Read Order

1. `pwa/HANDOFF_pwa_rebuild.md` ← 今回の summary + open tasks + first action
2. `pwa/BUGS.md` ← 末尾 2 件 (Slack bot Display Name 反映ハマり / meeting summary 固有名詞誤抽出) を必ず確認
3. `pwa/design_log/sessions_2026-05.md` の末尾 (= 2026-05-24 セッション全詳細)
4. `pwa/design/README.md`
5. `pwa/design/L2_DATA.md`
6. `pwa/design/meeting_summaries.md` ← cockpit MTGサマリモーダル化の正本仕様 (今回更新)
7. `pwa/design/project_strategy_signals.md`
8. `pwa/design/cockpit.md`
9. `pwa/design/FEATURE_REGISTRY.md`
10. `pwa/design/SPEC_GOVERNANCE.md`
11. `pwa/design/SPEC_pwa.md`
12. `/Users/masa/projects/knowledge/sx.md` 「実装周辺技術マップ v0.1」セクション (= SX 関連作業時のみ)
13. `~/.claude/projects/-Users-masa-projects-AMD-amd-os/memory/feedback_eimi_character_tone.md` + `feedback_tsukuyomi_character_tone.md` (= キャラ・口調の正本)
