/**
 * きよOS のモジュール（画面）一覧。
 *
 * ナビゲーションとダッシュボードのカードは、この配列から自動生成される。
 * 画面を足すときは、ここに 1 件足して src/app/(os)/<slug>/page.tsx を作るだけ。
 * ナビを手書きで足さないこと（docs/DESIGN.md も同じ commit で更新する）。
 */

export type ModuleStatus = "ready" | "skeleton" | "planned";

export type OsModule = {
  /** URL。ダッシュボードは "" */
  slug: string;
  /** ナビに出す名前 */
  label: string;
  /** カードに出す 1 行説明 */
  description: string;
  /** ナビ用の絵文字 */
  icon: string;
  status: ModuleStatus;
};

export const MODULES: OsModule[] = [
  {
    slug: "",
    label: "ホーム",
    description: "きよOS の入り口。今あるものを一覧する",
    icon: "🏠",
    status: "ready",
  },
  {
    slug: "today",
    label: "今日",
    description: "今日の予定・やること・メモを 1 画面で見る",
    icon: "🌅",
    status: "skeleton",
  },
  {
    slug: "wishlist",
    label: "ほしいもの",
    description: "きよが欲しい機能の候補。ここから作るものを決める",
    icon: "💡",
    status: "ready",
  },
  {
    slug: "settings",
    label: "設定",
    description: "接続状態と環境の確認",
    icon: "⚙️",
    status: "ready",
  },
];

export const STATUS_LABEL: Record<ModuleStatus, string> = {
  ready: "動く",
  skeleton: "枠だけ",
  planned: "未着手",
};

export const STATUS_CLASS: Record<ModuleStatus, string> = {
  ready: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  skeleton: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  planned: "bg-slate-500/15 text-slate-400 ring-slate-500/30",
};

export function hrefFor(module: OsModule): string {
  return module.slug === "" ? "/" : `/${module.slug}`;
}
