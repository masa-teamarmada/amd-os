# 次セッション移行プロンプト — 支払ゲートの修正要望表示は完了。ZMPの報酬配分の未決4点を、まさの判断へつなぐ（2026-11-15作成）

cwd: `/Users/masa/projects/AMD/amd-os` で起動して、以下をそのまま実行して。

## 読む順
1. `/Users/masa/projects/AGENTS.common.md`
2. AMD横断memory `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/AGENTS.md`、`pwa/AGENTS.md`
4. `/Users/masa/projects/AMD/amd-os/HANDOFF_gate_zmp_20261002.md`
5. `/Users/masa/projects/AMD/ZMP/支払通知書_202610_対応記録.md`（末尾の「ZMP報酬配分の確認事項」）と `/Users/masa/projects/AMD/ZMP/HANDOFF_支払通知書.md`
6. お金・報酬の実装を触る前に `pwa/manual/7-1-reward-calc-spec.md` を全文（hookが拾い読みを止める）
7. `pwa/spec/3-14-monthly-work-agreement-current-spec.md` のゲートの節、`pwa/BUGS.md` の先頭

## 状態スナップショット（2026-11-15 確認）
- git: main = origin/main、遅れ0・先行0。作りかけ1件（別セッション由来の `question-tree.module.css`、触らない）。作業フォルダの追従は `scripts/root-checkout-sync.py` がセッション開始時に自動で動く。
- 本番: v3.147.6（`e708a5250`）以降、別セッションの反映で更新済み（10/29 の確認では v3.165.23）。支払通知書の月初合意支払ゲートは、修正要望中の行の下に本文を出す。
- DB（nbnhrhybjslbawdukvvk、ZMP=p19）: しんの修正要望 `99e50966-19b0-46b8-888e-6f2b7c73384b` は open。水素助成金MSの担当は しん100%（こうの行なし）。うめ（ID008）は参加中のまま終了月が空。別財布（OkuDoorシステム開発130万円）の2026年10月の枠 `extra_budget_yen` は130万円のまま。
- ZMPの10月通知書: あび・うめ は まさ確定額で再作成済み（あび40,200円・うめ0円、税抜。別財布は含めない）。未送信・未振込。

## 次のタスク
まさに次の4点を、本文つきの選択肢で1回に絞って聞く。まさの回答が出るまで、配分・終了月・払い月のDBは変えない。
1. しんの修正要望: A＝担当内容の説明へ「OkuDoor向けの地域資源活用製品等の開発・販売促進事業の補助金申請」を書き足して対応済みにする。B＝OkuDoor側の業務として報酬を別に付ける（他の人の額が変わる）。
2. うめの終了月: 8月・9月・10月以降のどれか。決まったら `project_members` の終了月と、採用支援・OkuDoor現地運用・OkuDoorシステム開発の担当を、repoの正規の経路で直す。
3. 別財布の払い月: 納品の確認に連動させるか、請求月の設定のままにするか。
4. 「システム開発分とそれ以外は分けて表示してほしい」: 画面で見せる意味なら、どの画面（支払通知書・マイページ・月初合意）かを聞く。

## 確立済みの運用ルール
- 本番反映は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`。BUILD_VERSION を毎回上げる。別セッションと版が重なるので push 直前に `git fetch` して `HEAD..origin/main` を読む。
- 本番データを触る確認は、読み取りだけか、触る前の現在値を控えてから行う。メール・Slackの送信はしない。
- まさへの報告は、画面で何が変わったか→まさが決めること、の順。ファイル名・版番号は最後に1行。
- 報酬の数字を言う前に、DBの `billing_cycles.reward_summary_json` と `monthly_reward_payout` を読み、「生まれる額」と「支払う額（繰越を足した額）」を分けて書く。
