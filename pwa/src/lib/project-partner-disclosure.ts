import type { SxManagementPartner } from "./sx-management";

export const PARTNER_NAME_WITHHELD = "会社名非開示";

type DisclosurePartner = Pick<SxManagementPartner, "id" | "name" | "slug" | "nameDisclosureProhibited">;

/** 社外へ返す直前に処理する。内部正本・ブラウザ側の表示切替に依存しない。 */
export function redactProjectPartnerNames<T>(value: T, partners: readonly DisclosurePartner[]): T {
  const hidden = partners.filter(partner => partner.nameDisclosureProhibited === true);
  if (hidden.length === 0) return value;
  const ids = new Set(hidden.map(partner => partner.id));
  const replacements = hidden.flatMap(partner => [
    [partner.name, PARTNER_NAME_WITHHELD],
    [partner.slug, `undisclosed-${partner.id}`],
  ]).filter(([needle]) => needle.length > 0).sort((a, b) => b[0].length - a[0].length);
  const privateFields = new Set(["sourceRef", "sourceUrl", "source_ref", "source_url", "storageLocation", "nextMeetingPlace"]);
  const replace = (text: string) => replacements.reduce((result, [needle, replacement]) => result.split(needle).join(replacement), text);
  const visit = (item: unknown, relatedToHidden = false): unknown => {
    if (typeof item === "string") return replace(item);
    if (Array.isArray(item)) return item.map(entry => visit(entry, relatedToHidden));
    if (!item || typeof item !== "object") return item;
    const record = item as Record<string, unknown>;
    const isHiddenPartner = typeof record.id === "string" && ids.has(record.id);
    const related = relatedToHidden || isHiddenPartner || (typeof record.partnerId === "string" && ids.has(record.partnerId));
    return Object.fromEntries(Object.entries(record).map(([key, entry]) => [key,
      related && privateFields.has(key) ? null : isHiddenPartner && key === "name" ? PARTNER_NAME_WITHHELD : visit(entry, related),
    ]));
  };
  return visit(value) as T;
}

export function validatePartnerDisclosure(fields: { business_area?: unknown; name_disclosure_prohibited?: unknown }) {
  if (fields.name_disclosure_prohibited === true && (typeof fields.business_area !== "string" || !fields.business_area.trim())) {
    throw new Error("会社名を開示不可にするには事業領域が必要");
  }
}
