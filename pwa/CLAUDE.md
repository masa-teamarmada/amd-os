@AGENTS.md

# CLAUDE.md — AMD OS PWA 固有ルール

> **共通運用ルールは `~/.claude/CLAUDE.md` を参照。**
> このファイルには AMD OS PWA 固有の技術仕様だけを書く。

---

## 技術スタック

Next.js 16 + React 19 + Tailwind CSS v4

## プロジェクト情報

- **ローカルディレクトリ（正本）**: `/Users/masa/projects/AMD/amd-os/pwa`
- **バックエンド**: Supabase（直接接続） + AMD OS GAS（`WEBAPP_BASE_URL` 経由）
- **デプロイ**: Vercel（armada0130 / amd-os-pwa）
- **本番URL**: https://amd-os-pwa.vercel.app

## デプロイ方式・Git運用

- **現在のPWA本番反映はVercel CLIによるローカル直接deploy**。
- **VercelのGit自動deployを正本として使っていない**。別repo/branchから自動反映される前提で作業しないこと。
- 実装ベースは `main` checkout の `/Users/masa/projects/AMD/amd-os/pwa`。
- ただし現状は移行直後の大きな未コミット差分を含む。`main` のリモートHEADだけを見ても本番相当の実装とは限らない。
- `git remote -v`: `https://github.com/masa-teamarmada/amd-os.git`
- `git branch --show-current`: `main`
- `.vercel/project.json`: projectName `amd-os-pwa` / projectId `prj_raZW3HSKIszzPUwNTHfy7xDGzLHm`
- Claude/Codexがdeployする場合は、必ずこのローカルcheckoutから `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` を実行する。`--cwd .../pwa` は禁止。

## ドキュメント構成（**この順で読む**）

| 何を知りたいか | ファイル | 内容 |
|---|---|---|
| **AMD OS マニュアル正本** ⭐⭐⭐ (= 2026-05-25 以降) | `pwa/manual/1-1-intro.md` 〜 `9-3-appendix-changelog.md` | **ユーザー + 開発者マニュアル**。過去判断 / 用語と実装の対応 / cron 廃止経緯 / Codex-Claude-Vercel-LaunchAgent 責務分担マトリクス / 過去事故ログを集約。**新セッションは必ずここから読む** |
| **AMD OS 中核データ正本** ⭐⭐⭐ | `pwa/design/L2_DATA.md` | **L2 9 種 (monthly report / AMDプロトコル / MS進捗 / PJナレッジ / メンバーナレッジ / MTGサマリ / OS台帳差分 / XRL根拠 / 経営・事業シグナル) + レポート + 全 cron**。データに触る作業の前に必ず読む |
| **設計書 (/spec) 移行入口** ⭐ | `pwa/spec/1-1-overview.md` / `pwa/spec/1-2-document-layer-migration-map.md` | manual / spec / bzm の3層分割、移行中の正本境界、次に移す章の優先順位 |
| **再構築カバレッジ監査** ⭐⭐⭐ | `pwa/spec/1-3-reconstruction-coverage-audit.md` | `/spec` だけで current OS を再構築できるかの章別評価。作業前に該当領域の不足を確認する |
| **PWA runtime / L2 現行仕様** ⭐ | `pwa/spec/2-1-pwa-runtime-routes.md` / `pwa/spec/3-1-l2-data-extraction-current-spec.md` | PWA route/API/cron/auth と L2 ①〜⑨/outbox/採否ループ。移行完了まで `design/SPEC_pwa.md` / `design/L2_DATA.md` と両方見る |
| **設計 md フォルダ全体の入口** ⭐ | `pwa/design/README.md` | `/spec` 未移行領域の設計正本インデックス。**まずここを読んで「次に何を読むか」を決める** |
| **PWA 全体の正本仕様** ⭐ | `pwa/design/SPEC_pwa.md` | 画面・ルート・データモデル・cron・共通インフラ・運用コマンド・実装規約。`/spec` へ章移行予定 |
| **重要UI登録簿** ⭐ | `pwa/design/FEATURE_REGISTRY.md` | 画面ごとの「消してはいけない業務導線」と `test:critical-ui` anchor |
| **仕様統制** ⭐ | `pwa/design/SPEC_GOVERNANCE.md` | 仕様がmdへ書き込まれる仕組み、spec/ADR/traceability運用、新セッションの読み順 |
| **コックピット詳細 / 月次ルーティン** ⭐ | `pwa/design/cockpit.md` | PJ Status / MS / 経営・事業シグナル / 月次ルーティン stepId × クリック挙動 (回帰多発) |
| テーマ別設計 (Atlas / Venture Map / AMD Score / VC List 等) | `pwa/design/<topic>.md` | `pwa/design/README.md` の表参照 |
| 直近セッション + 次の一手 | `pwa/HANDOFF_pwa_rebuild.md` | スリム保持 (~200 行以下) |
| バグ・教訓 | `pwa/BUGS.md` | 症状/原因/解決策/教訓 形式 |
| 過去セッションの作業ログ | `pwa/design_log/sessions_YYYY-MM.md` | 月単位の作業ログ (append-only) |

**🚨 重要 — 設計 md の置き場所ルール**:
- 使い方は `pwa/manual/`、確定実装仕様は移行済みなら `pwa/spec/`、未移行なら `pwa/design/` に置く
- `pwa/design/` は廃止済みではなく移行中。既存ファイルを削除せず、章単位で `/spec` へ移す
- `/spec` の品質バーは「読めば current AMD OS を再構築できる」こと。薄い要約で終えず、入力/出力、DB table/column、API/route/function、batch/cron/automation、authority、failure mode、validation を書く
- manual / spec / bzm を変更したら、それぞれ `manual/9-3-appendix-changelog.md` / `spec/6-1-appendix-changelog.md` / `bzm/9-5-appendix-changelog.md` に日時つきで追記する
- `pwa/design_log/` には **過去セッションの sessions_*.md** だけ。新規設計 md を作ってはいけない (次セッションのえいみが見落とす)
- 新セッション開始時は **必ず `pwa/spec/1-1-overview.md` / `pwa/spec/1-2-document-layer-migration-map.md` と `pwa/design/README.md` から読む**

**🚨 handoff 時の OS マニュアル同期ゲート**:
- handoff を実行する時は、このセッションで実装・変更した新たな仕様を棚卸しする
- ユーザー/開発者が次回知るべき仕様なら、`pwa/manual/*.md` (= AMD OS マニュアル正本) に追記する
- 詳細仕様は移行済みなら `pwa/spec/*.md`、未移行なら該当 `pwa/design/*.md` / `FEATURE_REGISTRY.md` / `db_schema.md` に置き、マニュアルには読み手向けの要約と運用手順を置く
- 章対応は `pwa/src/app/(app)/manual/manual-chapters.ts` を見る。新章を作る場合は `manual-chapters.ts` と `pwa/design/os_manual.md` も同時に更新する
- 純粋な refactor / typo / test only など、マニュアル対象外なら「対象外: 理由」を書く
- handoff のチャット出力には `新仕様/仕様変更 | spec/design正本 | OSマニュアル章 | 状態` の表を必ず出し、すべて `✅` または `対象外: 理由` になるまで migration prompt に進まない

---

## 🔗 メンバーコードネームリンク（admin-only）

- OS内でAMDメンバーの `code_name` を文章・通知・カード・台帳セルに表示するときは、原則 `/mypage?memberId=<members.member_id>` にリンクする。
- `<members.member_id>` は Supabase の `members.member_id` をそのまま使う。例: `ID001`。`001` のように `ID` prefix を落としたURLは禁止。
- 他メンバーのマイページ閲覧は admin (`members.is_admin=true`) 専用。一般ユーザー向けの相互閲覧導線として扱わない。
- 自由文は共通UI `LinkedMemberText` を使い、構造化されたメンバー台帳・一覧では行の `member_id` から明示的に `Link` を組む。
- `/admin/members` の codeName セルはこの rule の基準UI。コードネームをクリックすると対象メンバーのマイページへ飛び、編集はセル内の編集ボタンから行う。

---

## 🔢 build version の bump up（毎回必須）

**コード修正で deploy する前に必ず [`src/lib/build-info.ts`](src/lib/build-info.ts) の `BUILD_VERSION` を bump up する**。

画面左上の AMD OS ロゴ直下に表示され、まさが見た瞬間に「リロード効いてるか」「Service Worker / CDN cache が新しい build に切り替わったか」を判別できるようにする運用ルール。

### bump up の粒度

- **patch (v0.3.0 → v0.3.1)**: 細かい修正 / UI 微調整 / バグ fix / デバグ目的の確認 / 既存機能の挙動変更 / リファクタ / UI 簡略化
- **minor (v0.3.0 → v0.4.0)**: **本物の新機能追加 / 新画面追加 / 新 DB テーブル追加**。 既存機能の整理は patch 止まり
- **major (v0.3.0 → v1.0.0)**: 大きな仕様変更 / アーキテクチャ刷新

**迷ったら patch**。 minor は「これは新機能と言える」と確信が持てる時だけ (= まさ #89 確定 2026-05-26 で patch 中心の運用に修正)。 audience 廃止 / リファクタ / UI 整理は patch。
**bump up を忘れたまま deploy しない**。

### キャッシュ問題の判別フロー

まさが「変更が反映されてない」と言ったとき:

1. **画面左上の version 表示を確認**
2. version が**新しい** → コードは反映されてる、表示ロジック側の問題 (filter / fetch / 別 snapshot 参照など)
3. version が**古い** → SW / CDN / ブラウザキャッシュ。DevTools → Application → Service Workers → Unregister + Clear site data + ハードリロード (Cmd+Shift+R)

---

## ⚠️ Vercel deploy approval gate（現在優先）

**2026-06-04以降、Vercel deploy/pushは再開可。ただしproduction deploy / preview deploy / Vercel自動deployを起こす可能性があるpushの直前には、必ずdeploy bundleつきでまさ許可を取る。**

- deploy bundleには、含める変更、除外する変更、local build/test/browser確認結果、deploy予定回数、push/deploy先、rollback/本番確認方法を含める。
- てにをは、微細UI、軽微CSS、md、コメント、ログ文言などを1件ずつdeployする運用は禁止。複数worker成果を束ねて1回でdeployする。
- 承認待ちは `approval pending` として台帳に残し、未分類blockerにしない。
- workerは local build / lint / static check / スクショ / ローカル確認で止める。必要ならlocal commitまではよい。
- `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh`、`npx vercel deploy`、Vercel auto deploy対象の `git push` の直前にはdeploy bundleを提示し、askuserquestionで承認を取る。

## ⚠️ Vercel デプロイコマンド（承認後の正本）

```bash
bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh
```

このスクリプトは:
1. `npx vercel --prod --yes --archive=tgz --cwd <repo-root>` で deploy トリガー
2. Build が Ready になるまで polling (最大 10 分)
3. 完了 → macOS 通知 (Glass 音) でまさに知らせる
4. 失敗 → Basso 音でエラー通知

**直接 `npx vercel` を叩かないこと**。Build 完了通知が出ないので、まさが「終わった?」と確認しに来る無駄が発生する (2026-05-07 のフィードバック)。

**`--cwd` は リポジトリ root** (`pwa/` ではない)。Vercel project `amd-os-pwa` の Settings → Build → Root Directory に `pwa` が設定されているため、`--cwd .../pwa` だと `pwa/pwa` 二重で失敗する (BUGS.md 2026-05-06 参照)。

**`--archive=tgz` 必須**。モノレポの upload 対象が 15000 files を超えることがあり、通常 deploy だと `files should NOT have more than 15000 items` で失敗する (2026-05-14 dashboard cyber handoff)。

事前確認:
- リポ root の `.vercel/project.json` が `amd-os-pwa` (`prj_raZW3HSKIszzPUwNTHfy7xDGzLHm`) を指していること。空だと `--yes` で誤って新プロジェクト `amd-os` が作られる
- 無ければ `cp -r /Users/masa/projects/AMD/amd-os/pwa/.vercel /Users/masa/projects/AMD/amd-os/.vercel` で復元

ロールバック方法（緊急時）:
```bash
npx vercel promote <デプロイID> --scope armada0130 --yes
# デプロイIDは vercel ls --scope armada0130 で確認
```

---

## ⚠️ DDL適用（Supabase Management API 経由）

```bash
python -X utf8 scripts/apply_ddl.py scripts/migrations/NNN_name.sql
```

- `.env.local` の `SUPABASE_ACCESS_TOKEN`（sbp_…）を使用
- **User-Agent ヘッダー必須**（Cloudflare 1010 回避）
- migrations は `scripts/migrations/NNN_name.sql` に必ず残す
- supabase-js REST + `rpc("exec_sql")` は存在しない。SQL Editor 手動依頼もNG

---

## 🚨 列名・テーブル名は想像で書かない (`db_schema.md` を必ず参照)

新規 cron / API route / Edge Function / GAS 関数で Supabase テーブルを叩く前に、
**[`design/db_schema.md`](design/db_schema.md) を必ず grep して実際の列名を確認**してから
select / filter / insert / upsert を書くこと。

過去事故: `member_activities` の列を `code_name` / `created_at` / `activity_text` / `kind` と
想像で書いたら全部間違ってて (実体は `member_id` / `extracted_at` / `content_preview` /
`source`)、PostgREST 42703 エラーで `actsRes.ok=false` → 入力ゼロで進行 → 他人の活動が
本人のものとして LLM 抽出される事故 (BUGS.md `[GAS] member_knowledge 抽出で「きよ」に他人の活動が紐付くカオス` 参照)。

**運用**:
- DDL を変更したら同じ commit で `python3 -X utf8 scripts/dump_schema.py` を実行して `design/db_schema.md` を再生成 → commit に含める
- 他の md (HANDOFF / 設計 md) で「テーブル X の列 Y」を書くときも、必ず `db_schema.md` から正しい列名をコピーする (= 二次情報を参照しない)
- えいみが新セッション開始時に「列名を書く必要があるなら必ず先に `db_schema.md` を grep する」セルフルールを徹底

`db_schema.md` は自動生成 (Supabase Management API → information_schema.columns)。
手動編集禁止 (= 次回再生成で消える)。

---

## 🧭 まさえいMTG (L2 ⑨ dialogue) の始め方

> **呼び方ルール (まさ #7 2026-05-24 確定)**: このセッションは「**まさえいMTG**」と呼ぶ。
> 「まさ × えいみ経営会議」「経営会議」とは書かない (= かる/ちこ など、そこに入っていない
> メンバーが疎外感を持つ「経営会議」表現を避けるため)。チーム外の人が読んだ時に「2 人で
> 議論したセッション」だと分かり、かつチームへの提案前提だと伝わる表現にする。

**まさが claude/codex セッションで「まさえいMTGやろう」「経営シグナル見よう」「signals レビュー」のいずれかを言ったら、即この手順に入る** (= 再起動不要、新セッション初回でもOK)。

詳細仕様: [`design/project_strategy_signals.md`](design/project_strategy_signals.md) の「議論セッション運用」セクション。

### えいみがやる手順

1. **candidate を全 PJ 横断 read** (= service_role REST または直 SQL):
   ```
   GET /rest/v1/project_strategy_signals
       ?select=signal_id,project_id,ym,signal_type,impact_level,decision_state,title,summary,signal_date,confidence
       &status=eq.candidate
       &order=impact_level.desc,signal_date.desc,created_at.desc
   ```
   - impact: `critical` > `high` > `medium` > `low` の順
   - 同 impact 内は signal_date / created_at で新しい順

2. **最初の 1 件を提示** (= 全部一気に出さない、1議題ずつ):
   - PJ コードネーム + signal_type chip + impact chip + title 1行 + summary 2-3行
   - 「これどう?」と短く問う

3. **まさの反応に応じて API を叩く** (= その場で、後でやらない):
   - `進める` / `これで確定` / `decided` → `POST /api/strategy-signals { action:'confirm', signal_id, decision_state:'decided' or 'executing', confirmed_by:'まさ' }`
   - `違う` / `不採用` / `保留` → `action:'reject'`
   - `こう修正` → `action:'update'` で title/summary/impact 等を差し替え
   - `これ別 signal で残したい` → `action:'create', status:'confirmed', decision_state:'decided'`

4. **次の議題へ。1セッションで 5-10 件目安**、まさが「これで終わり」と言うまで続ける

5. **セッションの最後に議論ログを保存** (= PJ単位、会社全体は p00):
   ```
   POST /api/dialogue-meeting
   { project_id, summary_short, decided[], progress[], next_actions[], risks[],
     related_signal_ids: [confirm/create した signal_id 全部] }
   ```
   - cockpit の MTGサマリ欄に自動で並ぶ (`source_kinds='dialogue'`)
   - PJ 横断で議論した場合は、関連 PJ ごとに 1 行ずつ insert (= まとめ1行でなく)
   - `summary_short` には「議論の背景 + 何を話したか」を 2-4 文で書く。1 行で済ませない
   - `decided[]` の項目は「**提案**」のニュアンスで書く (= まさえいMTGで議論して出した提案、チームに相談する前提)。「決定」「決まったこと」と書かない

6. **議事録の narrative 化** (= 5 の直後):
   ```
   POST /api/dialogue-meeting/narrate
   { meeting_id: "dialogue:{project_id}:..." }
   ```
   - Sonnet 4.6 が raw 配列を `## 🎯背景` → `## 📊経緯` → `## ✅決まったこと` → `## ▶️次の一手` → `## ⚠️残課題` の Markdown narrative に書き直し
   - まさえいMTGの `✅決まったこと` は「チームへ出す提案として固まったこと」の意味で書く。会社として正式決定済みと誤読される表現は避ける
   - `project_meeting_summaries.narrative_md` に保存される
   - cockpit の MTGサマリ詳細では narrative が主表示、raw は折りたたみ「元データ」へ
   - 全件まとめて narrate するなら `{ all: true, limit: 20 }` を叩く

### 認証

- まさ session でログイン済みなら admin auth で通る
- セッション外から叩くなら `Authorization: Bearer ${CRON_SECRET}` (= `.env.local` の `CRON_SECRET`)

### candidate が空 / 古いとき

`status='candidate'` 行が無い、または `signal_date` が 1 週間以上前なら、えいみが OS を横断 read して新規 candidate を `proposed` で積んでから議論を始める (= daily routine と同じ動作を手動でやる)。

横断 read 対象: `monthly_reports` / `project_meeting_summaries` / `tsukuyomi_nudge_queue` / `billing_cycles` / `project_xrl_log` / `atlas_signals` / `amd_management_score_snapshots` / `amd_management_score_evidence` (= p00 用)。

### よくある間違い

- ❌ 議題を 10 件一気に箇条書きで出す → 1 件ずつ会話形式で
- ❌ まさが返事する前に勝手に confirm する → まさの明示判断後
- ❌ 議論ログ保存を後回しにする → セッション終了時に必ず叩く
- ❌ p00 を忘れる → AMD 全体の議題 (Management Score / freee / 月次運用) は p00
