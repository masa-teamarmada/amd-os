/**
 * モデルの版を1か所から配る。
 *
 * まさ 2026-09-02:「常に最新のスコアでちゃんと表示して。表示してくれないと、
 * さっき書いたような検証ができないじゃん。」
 *
 * それまでは、算出スクリプトと係数の書き出しがそれぞれ承認番号を定数で持っていて、
 * どちらも手で更新されないまま古い番号を書き込んでいた。
 * 2026-09-02 の時点で、画面のスコアには #2026-08-29-3、係数表には #2026-08-29-1 が乗っていて、
 * 正本の現行は #2026-09-02-1 だった。**数字は最新なのに、ラベルだけが古い**という状態になり、
 * 画面を見ても最新かどうか判断できなかった。
 *
 * 版の出どころは `model/LOCK.json` の `approval_ref` にする。
 * ロックは正本を変えたときに `model_lock.cjs relock --approval <id>` で必ず更新されるので、
 * 承認と版が構造的にずれない。
 */
const fs = require('fs');
const path = require('path');

const LOCK_PATH = path.join(__dirname, '..', 'LOCK.json');

/** BZM のモデル系列の名前。式の骨格が変わったときだけ上げる。 */
const MODEL_VERSION = 'bzm-3.0';

/** 現行の承認番号。ロックから読む。読めなければ落とす（古い番号を書き込むより止まるほうが安全）。 */
function currentApprovalRef() {
  const lock = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
  if (!lock.approval_ref) throw new Error('model/LOCK.json に approval_ref が無い。relock を先に走らせる');
  return lock.approval_ref;
}

module.exports = { MODEL_VERSION, currentApprovalRef };
