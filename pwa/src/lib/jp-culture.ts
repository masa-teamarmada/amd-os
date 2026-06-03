/**
 * 🇯🇵 日本文化マップ — データアクセス + 階層/地理ヘルパ
 *
 * jp_culture_items テーブル (migration 123) を読み、
 *   - マインドマップ: category_path から大分類→中分類→小分類のツリーを動的構築
 *   - 日本地図: prefecture / city でグルーピングしてドリルダウン
 * の両方に使う共通ロジックをここに集約する。
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// read-only クライアント (anon)。supabase-data.ts と同じ理由でダミー値 fallback。
const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "amd-os-pwa-jp-culture-readonly",
    },
  }
);

export interface JpCultureLink {
  label: string;
  url: string;
}

export interface JpCultureItem {
  id: string;
  title: string;
  description: string | null;
  category_path: string[];
  prefecture: string | null;
  city: string | null;
  links: JpCultureLink[];
  image_url: string | null;
  sort_weight: number;
}

/** active な文化コンテンツを全件取得 (= マップ描画は全件をクライアントで階層化する) */
export async function fetchJpCultureItems(): Promise<JpCultureItem[]> {
  const { data, error } = await supabase
    .from("jp_culture_items")
    .select(
      "id,title,description,category_path,prefecture,city,links,image_url,sort_weight"
    )
    .eq("status", "active")
    .order("sort_weight", { ascending: false });

  if (error) {
    console.error("[jp-culture] fetch error:", error.message);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    category_path: Array.isArray(row.category_path)
      ? (row.category_path as string[])
      : [],
    prefecture: (row.prefecture as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    links: Array.isArray(row.links) ? (row.links as JpCultureLink[]) : [],
    image_url: (row.image_url as string | null) ?? null,
    sort_weight: (row.sort_weight as number) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// マインドマップ用: category_path からツリーを構築
// ---------------------------------------------------------------------------

export interface CultureTreeNode {
  /** 階層全体を表す一意 key。例: "文学/俳句" */
  id: string;
  /** この階層のラベル。例: "俳句" */
  label: string;
  /** ルート(=root)からの深さ。0 = 大分類 */
  depth: number;
  children: CultureTreeNode[];
  /** この階層 (= 葉) に直接ぶら下がるコンテンツ。中間ノードは空配列 */
  items: JpCultureItem[];
  /** 配下 (子孫含む) の総コンテンツ数 */
  totalItems: number;
}

/**
 * items を category_path に従ってツリー化する。
 * category_path = ['文学','俳句'] のアイテムは
 *   root → 文学 → 俳句 のノードを生成し、俳句ノードの items に入る。
 */
export function buildCultureTree(items: JpCultureItem[]): CultureTreeNode {
  const root: CultureTreeNode = {
    id: "__root__",
    label: "日本の文化",
    depth: -1,
    children: [],
    items: [],
    totalItems: 0,
  };

  const ensureChild = (
    parent: CultureTreeNode,
    label: string
  ): CultureTreeNode => {
    let child = parent.children.find((c) => c.label === label);
    if (!child) {
      const id = parent.id === "__root__" ? label : `${parent.id}/${label}`;
      child = {
        id,
        label,
        depth: parent.depth + 1,
        children: [],
        items: [],
        totalItems: 0,
      };
      parent.children.push(child);
    }
    return child;
  };

  for (const item of items) {
    const path = item.category_path.length > 0 ? item.category_path : ["未分類"];
    let cursor = root;
    for (const label of path) {
      cursor = ensureChild(cursor, label);
    }
    cursor.items.push(item);
  }

  // totalItems を後ろから集計 + 子をラベル順に安定ソート
  const tally = (node: CultureTreeNode): number => {
    node.children.sort((a, b) => a.label.localeCompare(b.label, "ja"));
    let sum = node.items.length;
    for (const c of node.children) sum += tally(c);
    node.totalItems = sum;
    return sum;
  };
  tally(root);

  return root;
}

// ---------------------------------------------------------------------------
// 地図用: prefecture / city でグルーピング
// ---------------------------------------------------------------------------

export interface CityGroup {
  city: string; // "市区町村未設定" を含む
  items: JpCultureItem[];
}

export interface PrefectureGroup {
  prefecture: string;
  items: JpCultureItem[];
  cities: CityGroup[];
}

/** prefecture → city の 2 段グルーピング。prefecture が null のアイテムは除外 */
export function groupByGeography(
  items: JpCultureItem[]
): Map<string, PrefectureGroup> {
  const map = new Map<string, PrefectureGroup>();

  for (const item of items) {
    if (!item.prefecture) continue;
    let pref = map.get(item.prefecture);
    if (!pref) {
      pref = { prefecture: item.prefecture, items: [], cities: [] };
      map.set(item.prefecture, pref);
    }
    pref.items.push(item);

    const cityLabel = item.city || "市区町村未設定";
    let city = pref.cities.find((c) => c.city === cityLabel);
    if (!city) {
      city = { city: cityLabel, items: [] };
      pref.cities.push(city);
    }
    city.items.push(item);
  }

  // 各県の city を件数降順
  for (const pref of map.values()) {
    pref.cities.sort((a, b) => b.items.length - a.items.length);
  }

  return map;
}
