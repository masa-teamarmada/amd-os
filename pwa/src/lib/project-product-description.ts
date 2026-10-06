export const PRODUCT_DESCRIPTION_CONFIG_KEY = "product_description";

export type ProjectProductDescriptionData = {
  version: 1;
  title: string;
  summary: string;
  bodyMd: string;
  sourceRefs: string[];
};

/** 明示登録した製品説明だけを読む。未登録と壊れた登録値を区別する。 */
export function parseProductDescription(value: unknown): ProjectProductDescriptionData | null {
  if (value == null || value === "") return null;
  let parsed: unknown;
  try {
    parsed = typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    throw new Error("製品説明資料の登録形式が正しくない");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("製品説明資料の登録形式が正しくない");
  }
  const data = parsed as Record<string, unknown>;
  const isText = (text: unknown): text is string => typeof text === "string" && text.trim().length > 0;
  if (data.version !== 1 || !isText(data.title) || !isText(data.summary) || !isText(data.bodyMd)
    || !Array.isArray(data.sourceRefs) || data.sourceRefs.length === 0 || !data.sourceRefs.every(isText)) {
    throw new Error("製品説明資料の登録形式が正しくない");
  }
  // 登録値に別の内部項目が含まれていても、DDへ渡すのはこの文書の項目だけ。
  return { version: 1, title: data.title, summary: data.summary, bodyMd: data.bodyMd, sourceRefs: data.sourceRefs };
}
