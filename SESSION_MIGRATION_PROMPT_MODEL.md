cd /Users/masa/projects/AMD/amd-os

（このファイルはモデル層専用。並行セッションが使う SESSION_MIGRATION_PROMPT.md / _SPS.md とは別物なので上書きしないこと）

## 読む順
1. /Users/masa/projects/AGENTS.common.md — えいみ共通ルールの正本
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md — AMD 横断 memory
3. /Users/masa/.claude/projects/-Users-masa-projects-AMD-amd-os/memory/MEMORY.md — このPJ専用 memory
4. HANDOFF.md — 現在地と次の一手
5. model/MODEL_VERSION_LEDGER.md — **モデルページの中身**（目的3件・要件12件・確定している構造・要件ごとの土台・役割分担）。
   ただし正本は「OS のモデルページ `/model`」であって md ではない。まさには「モデルページ」と呼ぶ
6. model/APPROVALS.md — まさの承認記録（#2026-08-24-9 まで）。正本を変えるにはここに承認を記録してから relock
7. model/README.md — モデル変更の運用規約（提案→承認→変更→relock→changelog）
8. model/proposals/2026-08-24_step4_scoring-model-v3.md — **いま採否を仰いでいる第3案**（補訂1 済み）
9. model/proposals/2026-08-23_step3_giants-shoulders.md — 手順3（要件ごとの土台。状態 `reference`＝えいみ確定）
10. pwa/design_log/sessions_2026-08.md の 2026-08-23〜24 節 — 開発の履歴（根拠の印、式の層の修正）

## 状態
- branch は `main` のみ、origin と同期。HEAD は `eff52254`。作業ツリーは他セッションの dirty のみ（触らない）
- 共有 checkout に常時5〜10セッション並行。着手前に `git fetch --all --prune` → `git log --oneline -15` → `git status -sb`
- `/model` は admin 限定で本番稼働中。ページは model/MODEL_VERSION_LEDGER.md をそのまま描画する
- モデル正本12件は model/LOCK.json でロック済み（critical-ui guard / pre-commit / Claude Code の PreToolUse hook の3層）
- まさが合意済み: 目的3件、要件12件、確定している構造（領域・地平・二階建て・出力の形と価値項・産業創出効果の数え方）、
  スコアの最上段の式 V=∫E[Π(ω)|θ]dB₀(θ)
- 未承認: 手順4 第3案の中身（盤面・過程・係数）、旧 SPS 改訂案（2026-08-22、保留）

## 次のタスク
**まさへ手順4 第3案の採否を仰ぐところから。**

第3案の芯（まさへ説明するときは、この粒度の平易さを保つこと）:
- 一件の案件を「月ごとに進む盤面」として表す。盤面＝関門の位置／燃料の残高（自由資金と公的資金の二勘定、円建て）／
  権利と学内承認の残件／会社化したか／受託契約の拘束／稼働している用途／これまでの成否
- 案件の体質 θ（変換能力・技術の核・専有可能性・支払上限・追い風・エバンジェリスト候補の実在など）は見えないので帯で置く
- 盤面は「登録された計画の規則」（観測できる出来事にだけ条件づけた分岐。無ければ分野別の既定）で進み、
  正本の9区分（期限内資本自立／期限後資本自立／ライセンス／M&A／知財売却／ピボット／撤退／清算／未決着の継続）に落ちる
- 会社化は「何月」でなく「この条件になったら」の規則。最適な規則との差が「早すぎ・遅すぎ」の診断になる（窓は両側から閉じる）
- 価値は道筋の上で立つ国内付加価値の純増（置き換えと反実仮想を控除）を社会的割引率で現在価値化したもの
- ファンドの取り分 V^eq は資本政策の仮定を別入力にした別勘定（スコアと混ぜない）

採用されたら: APPROVALS に引用を記録 → 第3案の状態を承認済みへ → 模型の要約をモデルページのどこまで載せるかを提案 →
次の段（標準関門表・機能分解表・登録簿・計画規則テンプレの様式、係数の分野別初期値、社会的割引率の値、
継続価値の恒久形、資本政策の仮定様式、735件の判断帯からの移行手順、較正計画）。
差し戻しなら指摘を第4案へ。不採用なら model/withdrawn/ へ移す。

## 守る運用ルール（このPJで確立済み）
- モデルページにはまさが合意した内容だけを書く。抽出しただけの内容は置かない
- **正本の本文に、まさの発言の引用をそのまま書かない**。`[根拠](#evidence "まさ 2026-08-23「…」")` の印にする
  （画面がマウスオーバーで出す）。表に「根拠」列を作らない
- **「Aではない」を正本に書かない**。えいみの勘違いをまさが否定したら、誤記を消すだけ。否定文・原則文を書かない。
  「採らない主張」「要件にしないもの」の表に載せるのは、まさが検討して棄却した候補だけ
- **自明なことを質問しない**。まさに聞くのは要件の意味と価値基準だけで、専門語を使わず具体例で書く。
  理論・文献の選定、数理設計、文書の書き方はえいみが確定し、批判監査を通してから完成案の採否だけを仰ぐ
- 監査は属性を分ける（経営学者／経済学者／DTSU 経営者／VC／大学産連本部長）。学術2体は重いモデル、実務3体は軽いモデルで足りる。
  「解決した」という体裁の誇張は閉包検証で必ず突かれるので、対応表は正確に書く
- モデル正本を変えるには: 提案を model/proposals/ へ → まさへ本文で提示 → 承認の発言を model/APPROVALS.md へ引用つきで記録 →
  正本を変更 → `node pwa/scripts/model_lock.cjs relock --approval <id>` → 同じ commit で bzm/9-5-appendix-changelog.md に1行
- git add はパスを名指しし、stage と commit は1コマンドにまとめる。他セッションへメッセージを送らない

## 検証手順
```
cd /Users/masa/projects/AMD/amd-os && node pwa/scripts/model_lock.cjs check
cd pwa && npx tsc --noEmit && npm run test:critical-ui && npm run test:model-formula-canon
```
本番反映は main への push（Vercel Git 自動 deploy）。
