import fs from "node:fs";
import path from "node:path";
import { bzmContentDir } from "@/lib/bzm-content-dir";
import { modelContentDir } from "@/lib/model-content-dir";

/**
 * モデル正本 md / json のサーバ側スナップショット。
 *
 * モデル定義は参照系データ (読み取り専用・更新はまさの承認を経た relock のときだけ) なので、
 * リクエストのたびに fs を読み直さず、プロセス内に TTL 付きで持つ。
 * 規範は AGENTS.common.reference.md「参照系データの体感速度」、
 * PWA での適用は pwa/spec/5-10-reference-data-caching-current-spec.md の
 * 「1. サーバのプロセス内スナップショット」。
 *
 * 正本そのものは `model/LOCK.json` の sha256 で凍結されているため、TTL 内に中身が
 * 入れ替わることは運用上ない。開発中の md 編集を拾うために TTL は短めに置く。
 */

const TTL_MS = 5 * 60 * 1000;

type Entry = { value: string | null; storedAt: number };

const cache = new Map<string, Entry>();

/** 正本ディレクトリの種別。`bzm/` は教科書原稿、`model/` は版数台帳。 */
export type CanonRoot = "bzm" | "model";

function rootDir(root: CanonRoot): string {
  return root === "bzm" ? bzmContentDir() : modelContentDir();
}

/**
 * 正本ファイルを読む。見つからなければ null (呼び出し側は「準備中」を出して落ちない)。
 * 同じ (root, relPath) は TTL 内でプロセス内キャッシュから返す。
 */
export function readModelCanonFile(root: CanonRoot, relPath: string): string | null {
  const key = `${root}:${relPath}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.storedAt < TTL_MS) return hit.value;

  const filePath = path.join(rootDir(root), relPath);
  let value: string | null = null;
  try {
    if (fs.existsSync(filePath)) value = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    console.error("[model] 正本ファイルの読み込みに失敗しました:", filePath, err);
    value = null;
  }
  cache.set(key, { value, storedAt: Date.now() });
  return value;
}

/** 正本を書き換えた経路 (relock 等) から呼ぶ。引数なしで全捨て。 */
export function invalidateModelCanonCache(root?: CanonRoot, relPath?: string): void {
  if (!root) {
    cache.clear();
    return;
  }
  if (!relPath) {
    for (const key of cache.keys()) {
      if (key.startsWith(`${root}:`)) cache.delete(key);
    }
    return;
  }
  cache.delete(`${root}:${relPath}`);
}
