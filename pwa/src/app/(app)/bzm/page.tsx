import { redirect } from "next/navigation";

/**
 * /bzm — 教科書 (章頭ストーリー型、2026-06-13 差し替え) の入口。
 * 旧ナラティブ版は /bzm/public/00-prologue で引き続き閲覧できる。
 */
export default function BzmIndexPage() {
  redirect("/bzm/strategic-slack");
}
