import { redirect } from "next/navigation";

/**
 * /model/formulas — モデルページ本体へ集約したため、ここは転送だけ残す。
 *
 * まさ確定 2026-08-23「正本は UI 上のものを指してる」「UI 上にないとだめ」により、
 * すべての式とすべての記号は 1 クリック先ではなくモデルページ (/model) の上に置いた。
 * 2026-08-23 に一時的に存在したこの URL を踏んでも迷子にならないよう転送する。
 */
export default function ModelFormulasRedirect() {
  redirect("/model#formulas");
}
