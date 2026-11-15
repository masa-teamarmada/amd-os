cd /Users/masa/projects/AMD/amd-os

（このファイルはモデル層専用。並行セッションが使う `services/project-share/SESSION_MIGRATION_PROMPT.md` とは別物なので上書きしないこと。
リポジトリ直下の `HANDOFF.md` は請求書の立替税率の引き継ぎなので、モデル層の引き継ぎは `model/HANDOFF.md`）

## 読む順
1. /Users/masa/projects/AGENTS.common.md — えいみ共通ルールの正本（敬語を使わない、一人称はあたし、報告は非開発者向け）
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md — AMD 横断 memory
3. /Users/masa/.claude/projects/-Users-masa-projects-AMD-amd-os/memory/MEMORY.md — このPJ専用 memory
4. model/HANDOFF.md — 現在地・まさ判断待ち・次の最初の作業
5. OS のモデルページ /model（正本）。読み込み元は model/MODEL_VERSION_LEDGER.md（§5 が BZM 3.0 の定義、§6 が運用一式と係数、§7 が較正の台帳）。まさには「モデルページ」と呼ぶ
6. model/APPROVALS.md（最新 #2026-11-11-1）／model/README.md（変更の運用規約）
7. model/cases/SCORES.md・INVENTORY.md — スコア一覧と入力の棚卸し。スコアの正本は OS の /seeds と DB seed_bzm30_scores
8. pwa/spec/4-8-bzm30-seed-score-panel-current-spec.md — OS 内の自動算出の現行仕様
9. pwa/design_log/sessions_2026-08.md の「2026-08-26〜27 BZM 3.0 参照実装に…」節と pwa/BUGS.md の [モデル] 2件

## 状態（2026-11-15 に確認）
- branch は main のみ。確認時点で origin と同期（ahead 0 / behind 0）。共有 checkout に常時5〜10セッション並行なので、着手前に git fetch --all --prune → git log --oneline -15 → git status -sb
- 未コミットは他セッションのもの（確認時点: pwa/src/components/question-tree/question-tree.module.css）。触らない
- ロック12件（model_lock.cjs check）。承認の最新は #2026-11-11-1（会社化前の前進をゲートの種類で分け、Q34 の 0.35 を廃止）
- 参照実装 model/tools/bzm30_forward.cjs は動く（degen / conv / calib / sens）。degen は約20分。runOne の第5引数 init で案件ごとの観測状態を渡せる
- 2026-08-26〜27 のセッション（承認 #2026-08-26-1・#2026-08-27-1 の反映、撤退の四経路、経済性の乗数、手作業の算出）は、その後の別セッションが休眠の書き直し・反実仮想の控除の撤回・OS 内の自動算出へ発展させ済み。当時の数値は現在値ではない

## 次のタスク
model/proposals/ の未承認のうち、このセッションの近似 A16（複数用途を1本に畳む）に関わる
2026-09-04_bzm30-multi-use-case-aggregation.md を、現在の正本（§5.7・§5.8）と実装に突き合わせ、
まさが判断できる文面（変更文・効果・副作用）にして本文で提示する。判断が下りたら
APPROVALS へ引用のまま記録 → 正本へ反映 → node pwa/scripts/model_lock.cjs relock --approval <id> →
同じ commit で bzm/9-5-appendix-changelog.md に1行、の順。

ほかの未承認の提案と未解決（5-12 の spec-chapters 未登録、確率の合計=1 の検査が未実施）は model/HANDOFF.md にある。

## このPJで確立済みの運用ルール
- 正本はモデルページ本体ただ一つ。定義・式・値は model/MODEL_VERSION_LEDGER.md に書き、別ファイルへ切り出さない。model/proposals/ は提案中のものだけ。ロックに model/proposals/ を入れない（承認エントリの「対象ファイル:」に書かず、外すときは「削除パス:」で申告）
- 提案中の値を、未承認と明示せずに使わない
- 根拠は2種類で混ぜない。まさの発言は [根拠](#evidence "…")（印の中で " を使わない）、外部文献は [N](#ref-N "書誌")。実在を確認した書誌だけ載せる
- 比喩・ぼかした表現を使わない。記号と期間はその場で定義する。「Aではない」を正本に書かない
- スコアの報告は下限・中央・上限と上限÷下限。9区分（撤退を含む）を主要指標に並べない。SPS は産業創出価値を測るもので、倒産確率を測るものではない
- 算出は OS の生データから自動で行う。えいみが手でウェブを調べて手で数値を打ち込む算出は、OS の情報を使わないので禁止。ネットで調べた数値は、OS の該当テーブルへ入れてから入力に使う
- 実装に入っていない機構は近似の一覧で明示する。近似誤差は測って表示する。推定できないものを初期値で置かない
- 実装を変えたら、確率の合計が 1 になること、評価日の資金・天井を振ったときの向きが直感と合うことを確認する。向きが逆転したら実装の取り違えを先に疑う（2026-08-27 のバグ2件はどちらもこれで見つかった）
- 背景で走らせる計算は、何を走らせたか・いつ終わる見込みかをその場で書く。「これから始める」と書いて何も走らせずに終わらない（2026-08-27 に2回、まさから「止まってる」と指摘された）
- 画面は情報密度を上げる。確認する画面は desktop 実寸で測る（PWA のスマホ幅は対象外）
- git add はパスを名指しし、stage と commit は1コマンドにまとめる。push 直前にもう一度 git fetch する。他セッションへメッセージを送らない。本番反映は deploy.sh を通す

## 検証手順
node pwa/scripts/model_lock.cjs check
cd pwa && npx tsc --noEmit && npm run test:critical-ui && npm run test:model-formula-canon
node model/tools/bzm30_forward.cjs degen   # 縮退検査（約20分）
node model/tools/bzm30_forward.cjs conv    # 格子の収束検査

npx tsc --noEmit は他セッションの編集中ファイルで落ちることがある。自分が触ったファイル以外のエラーは切り分けて報告し、直さない。
配信版は https://amd-os-pwa.vercel.app/api/build-info の git_sha で確認する。
