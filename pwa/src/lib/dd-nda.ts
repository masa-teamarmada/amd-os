/** DD入場時の締結済み申告。署名・契約台帳の締結状態とは別の記録。 */
export const DD_NDA_CONFIRMATION_VERSION = "2026-10-12.1";
export const DD_NDA_STUDIO_NAME = "株式会社チームアルマダ";
export function ddNdaPartyLabel(profile: { legal_status: string; legal_name: string | null } | null): string {
  if (profile?.legal_status !== "incorporated") return DD_NDA_STUDIO_NAME;
  const name = profile.legal_name?.trim();
  if (!name) throw new Error("dd_nda_company_name_missing");
  return name === DD_NDA_STUDIO_NAME ? name : `${DD_NDA_STUDIO_NAME}または${name}`;
}
export function ddNdaPrompt(partyLabel: string): string {
  return `このDDパッケージ内で開示されるすべての情報は秘密情報です。追加・更新される情報も含みます。${partyLabel}との秘密保持契約を締結済みですか？`;
}
/** DD本文・同一パッケージ内の戻り先に限定。外部URL・別PJ・確認APIへ移動しない。 */
export function ddNdaReturnPath(slug: string, value?: string): string {
  const root = `/dd/${encodeURIComponent(slug)}`;
  if (!value || value.includes("\\") || /[\x00-\x20]/.test(value)) return root;
  try {
    const url = new URL(value, "https://dd.invalid");
    if (url.origin !== "https://dd.invalid" || !value.startsWith("/")) return root;
    if (url.pathname !== root && !new RegExp(`^${root}/(?:items/[0-9a-f-]{36}(?:/file)?|edit|print|(?:short|long)-term-plan-document)$`, "i").test(url.pathname)) return root;
    url.searchParams.delete("returnTo");
    return url.pathname + url.search;
  } catch { return root; }
}
