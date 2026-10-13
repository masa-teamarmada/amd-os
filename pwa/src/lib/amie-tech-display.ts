import type { TechEntry, TechTopic } from "./project-tech";

export type AmieTechDisplayState = "dd" | "excerpt" | "private" | "review";
type Record = TechEntry | TechTopic;
export type AmieTechDisplayContext = {
  enabled: boolean;
  sharedEntries?: Map<string, TechEntry>;
  parentStatus?: Record["disclosure_status"];
  external?: boolean;
};
/** 原本の掲載指定ではなく、サーバーが実際に返すDD抜粋と照合する。 */
export function amieTechSharedEntry(entry: TechEntry, context?: AmieTechDisplayContext) {
  return entry.disclosure_level || context?.external ? entry : context?.sharedEntries?.get(entry.tech_entry_id);
}
export function amieTechDisplayEnabled(record: Record, context?: AmieTechDisplayContext) {
  return !!(context?.enabled || record.disclosure_level);
}
function equal(a: unknown, b: unknown) {
  return typeof a === "string" && typeof b === "string" ? a.trim() === b.trim() : (a ?? null) === (b ?? null);
}
export function amieTechFieldState(record: Record, shared: Record | undefined, fields: string[], parentStatus?: Record["disclosure_status"]): AmieTechDisplayState {
  if (record.disclosure_status === "needs_review" || parentStatus === "needs_review") return "review";
  if (record.disclosure_level) return "dd";
  if (!shared) return "private";
  const source = record as unknown as {[key:string]:unknown}; const target = shared as unknown as {[key:string]:unknown};
  return fields.every(key=>equal(source[key],target[key])) ? "dd" : "private";
}
/** 見出しの「一部DD開示」は、原本全体の開示と区別する。 */
export function amieTechRecordState(record: Record, shared: Record | undefined, fields: string[], parentStatus?: Record["disclosure_status"]): AmieTechDisplayState {
  const state = amieTechFieldState(record,shared,fields,parentStatus);
  return state === "private" && shared ? "excerpt" : state;
}
