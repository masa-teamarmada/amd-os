import fs from "node:fs";
import path from "node:path";

/**
 * モデル版数台帳 (`amd-os/model/`) のディレクトリ解決。
 *
 * BZM (教科書) の md がモノレポルート直下 `amd-os/bzm/` にあるのと同じ理由で、
 * `model/` も pwa/ の外に置く (2026-08-22 まさ確定)。教科書と設計書はそれぞれ
 * 別の話が正本 (本の原稿 / 実装仕様) だが、ここはモデルそのものの版数台帳。
 * 解決ロジックは bzm-content-dir.ts と同じ思想でここ 1 箇所に集約する。
 *
 * cwd は通常 Next.js のプロジェクトディレクトリ (= pwa) を指すが、実行環境によっては
 * リポジトリルートになりうる。どちらでも当たるよう候補を順に見る。
 */
const CANDIDATE_PREFIXES = ["..", "."];

export function modelContentDir(): string {
  for (const prefix of CANDIDATE_PREFIXES) {
    const dir = path.resolve(process.cwd(), prefix, "model");
    if (fs.existsSync(dir)) return dir;
  }
  // 見つからない場合も想定パスを返す。呼び出し側は existsSync / loadModelCurrent の
  // null 分岐で「台帳準備中」を出す。
  return path.resolve(process.cwd(), "..", "model");
}
