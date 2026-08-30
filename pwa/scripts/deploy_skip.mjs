#!/usr/bin/env node
/**
 * 画面に出ない変更だけの push で、本番の反映（Vercel のビルド）を1件消費しないようにする。
 *
 * まさ 2026-08-30「文書だけの変更でなんでデプロイが必要なの？」
 *
 * ── なぜこの形なのか ────────────────────────────────────────────
 * 2026-08-29 に「pwa に差分が無ければビルドしない」という判定を Vercel 側（vercel.json の
 * ignoreCommand）へ入れたが、ビルド環境の git では過去の commit との比較が成立せず、
 * **本番の反映を1件のエラーと3回以上の誤った見送りで丸1日止めた**。2026-08-30 15:13 に外して
 * 「main は必ずビルド」へ戻っている（commit 76cd42d6）。
 *
 * だからここでは Vercel 側で判定しない。**手元（履歴が全部ある）で判定して、Vercel には
 * 判定結果だけを渡す**。渡し方は commit メッセージの `[skip ci]` で、Vercel はデプロイを
 * 作る前にこれを見る（ビルド環境の git に依存しない）。
 *
 * ── 安全側の設計 ──────────────────────────────────────────────
 * 「画面に出る場所」を数え上げると、新しく md を画面へ出す機能を作ったときに足し忘れて、
 * その文書だけ永久に反映されなくなる。だから**逆にする**——
 * **「画面に出ないと分かっている場所」だけを並べ、そこに全部収まっているときだけ飛ばす。**
 * 知らない場所を触ったら必ず反映する。一覧の更新を忘れても、壊れる側へは倒れない。
 *
 * 二段で守る:
 *   1. commit のとき（prepare-commit-msg）… staged が全部この一覧に収まっていれば `[skip ci]` を足す
 *   2. push のとき（pre-push）… **いま本番に載っている地点**と HEAD を比べ、画面に出る場所に
 *      差があるのに先頭 commit が `[skip ci]` なら止める。1 の判定は「その commit だけ」を
 *      見ているので、下に積んである他の変更を巻き込まないための網
 *
 *   node pwa/scripts/deploy_skip.mjs --decide-commit <msgfile>
 *   node pwa/scripts/deploy_skip.mjs --gate-push
 *   node pwa/scripts/deploy_skip.mjs --explain            … いまの HEAD がどう判定されるか
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";

/**
 * 画面に出ないと**実際に確かめた**場所だけを並べる。ここに無い場所は必ず反映する。
 *
 * 確かめ方（2026-08-30）:
 *   - マニュアル・仕様書・テキストブック・モデルページの本文は
 *     `pwa/next.config.ts` の outputFileTracingIncludes でデプロイへ焼き込まれる。
 *     デプロイは作り直すまで中身が変わらないので、反映しないと画面が古いまま残る
 *   - モデルページが本文として出すのは model/*.md と model/proposals/*.md と
 *     model/withdrawn/*.md だけ（model-data.ts の MODEL_MD_SUBDIRS）。
 *     どの文書を出すかは model/CURRENT.json の一覧で決まり、そこに model/cases は入っていない
 *   - pwa/src は pwa/scripts を一度も読んでいない（grep で確認）
 */
const SCREEN_INVISIBLE = [
  // 引き継ぎ・事故の記録・会話の記録。OS のどの画面にも出ない
  /^HANDOFF(_[^/]*)?\.md$/,
  /^SESSION_[^/]*\.md$/,
  /^BUGS\.md$/,
  /^(README|AGENTS|CLAUDE)\.md$/,
  /^design_log\//,
  /^knowledge\//,
  // 論文の原稿と図。OS の画面ではなく外部へ出す成果物
  /^PAPER_[^/]*\.(md|html)$/,
  /^figures[^/]*\//,
  // モデルの作業メモと計算の道具。モデルページが本文として出すのは model 直下と
  // proposals / withdrawn だけで、cases と tools はどのスラッグにも対応しない
  /^model\/cases\//,
  /^model\/tools\//,
  // PWA 側の、画面に出ない置き場
  /^pwa\/design_log\//,
  /^pwa\/BUGS\.md$/,
  /^pwa\/AGENTS\.md$/,
  // 検査・移行・道具。Next のビルド出力に入らず、src からも読んでいない
  /^pwa\/scripts\//,
  // git の hook。手元でしか動かず、デプロイには入らない
  /^\.githooks\//,
];

const SKIP_MARK = "[skip ci]";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function isInvisible(p) {
  return SCREEN_INVISIBLE.some((re) => re.test(p));
}

/** 画面に出る（＝反映が要る）変更だけを返す */
function visibleChanges(paths) {
  return paths.filter((p) => p && !isInvisible(p));
}

// ───────────────────────────────── commit のとき

if (process.argv.includes("--decide-commit")) {
  const msgFile = process.argv[process.argv.indexOf("--decide-commit") + 1];
  if (!msgFile || !fs.existsSync(msgFile)) process.exit(0);
  let staged = [];
  try {
    staged = git(["diff", "--cached", "--name-only"]).split("\n").filter(Boolean);
  } catch {
    process.exit(0);
  }
  if (staged.length === 0) process.exit(0);
  const visible = visibleChanges(staged);
  const msg = fs.readFileSync(msgFile, "utf8");
  if (visible.length === 0 && !msg.includes(SKIP_MARK)) {
    // 1行目の末尾へ足す。Vercel は先頭 commit のメッセージ全体を見るが、
    // 件名に入れておくと git log でも「反映しない commit」だと分かる
    const lines = msg.split("\n");
    lines[0] = `${lines[0].trimEnd()} ${SKIP_MARK}`;
    fs.writeFileSync(msgFile, lines.join("\n"));
    console.error(`  画面に出ない変更だけなので、本番の反映を飛ばす（${SKIP_MARK} を付けた）`);
  }
  process.exit(0);
}

// ───────────────────────────────── push のとき

const PROD = process.env.AMD_OS_PROD_URL || "https://amd-os-pwa.vercel.app";

async function deployedSha() {
  try {
    const res = await fetch(`${PROD}/api/build-info`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const sha = (await res.json())?.git_sha;
    if (typeof sha !== "string" || sha.length < 7) return null;
    // 手元にその commit が無いこともある（他セッションが先に反映した直後など）
    try { git(["cat-file", "-e", `${sha}^{commit}`]); } catch { return null; }
    return sha;
  } catch {
    return null;
  }
}

const gate = process.argv.includes("--gate-push");
const explain = process.argv.includes("--explain");
if (!gate && !explain) {
  console.error("使い方: --decide-commit <msgfile> | --gate-push | --explain");
  process.exit(2);
}

const sha = await deployedSha();
if (!sha) {
  if (explain) console.log("いま本番に載っている地点が取れないので、反映は飛ばさない（安全側）");
  process.exit(0);
}

let changed = [];
try {
  changed = git(["diff", "--name-only", `${sha}..HEAD`]).split("\n").filter(Boolean);
} catch {
  process.exit(0);
}

const visible = visibleChanges(changed);
// **件名（1行目）だけを見る。** 本文に「[skip ci] を入れても止まらなかった」のような
// 説明を書いただけで飛ばす判定になると、画面の変更が本番へ出ないまま残る（実際に踏んだ）。
const headSubject = git(["log", "-1", "--pretty=%s"]);
const marked = headSubject.includes(SKIP_MARK);

if (explain) {
  console.log(`本番の地点: ${sha.slice(0, 8)}`);
  console.log(`本番以降に変わったファイル: ${changed.length} 件（うち画面に出るもの ${visible.length} 件）`);
  if (visible.length) console.log(`  画面に出る変更: ${visible.slice(0, 10).join(", ")}${visible.length > 10 ? " ほか" : ""}`);
  console.log(`先頭 commit の ${SKIP_MARK}: ${marked ? "あり" : "なし"}`);
  console.log(visible.length === 0
    ? "→ この push は反映が要らない"
    : `→ この push は反映が要る${marked ? "。**なのに飛ばす印が付いている**" : ""}`);
  process.exit(0);
}

if (visible.length > 0 && marked) {
  console.error("\n🛑 この push には画面に出る変更が含まれているのに、先頭の commit に反映を飛ばす印が付いている。");
  console.error("   このまま push すると、その変更が本番へ出ないまま残る（2026-08-29 に丸1日そうなった）。\n");
  console.error("   本番以降に変わった、画面に出るファイル:");
  for (const p of visible.slice(0, 15)) console.error(`     - ${p}`);
  if (visible.length > 15) console.error(`     …ほか ${visible.length - 15} 件`);
  console.error(`\n   直し方: git commit --amend で件名から ${SKIP_MARK} を外すか、`);
  console.error("   画面に出ない変更だけの commit を先頭に持ってこない。\n");
  process.exit(1);
}

if (visible.length === 0 && !marked) {
  console.error(`\n💡 この push は画面に出る変更を含まないので、本番の反映は要らない。`);
  console.error(`   先頭 commit の件名へ ${SKIP_MARK} を足すと1件節約できる:`);
  console.error(`     git commit --amend -m "$(git log -1 --pretty=%s) ${SKIP_MARK}"\n`);
}

process.exit(0);
