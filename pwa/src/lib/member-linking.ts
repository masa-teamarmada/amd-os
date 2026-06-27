export type MemberLinkTarget = {
  memberId: string;
  codeName: string;
  memberName?: string | null;
};

export type MemberLinkedTextPart = string | MemberLinkTarget;

const WORDISH_CHAR_RE = /[\p{L}\p{M}\p{N}_]/u;
const JAPANESE_PARTICLE_CHARS = new Set(["は", "が", "を", "に", "へ", "と", "で", "の", "も", "や", "か"]);
const JAPANESE_HONORIFIC_SUFFIXES = ["さん", "氏", "先生", "くん", "ちゃん"];
const MEMBER_NAME_HONORIFIC_SUFFIXES = ["さん", "氏", "先生", "くん", "ちゃん", "様", "代表", "社長"];
const JAPANESE_PARTICLE_CLASS = "はがをにへとのもやか";
const LEFT_TEXT_BOUNDARY = "(^|[^\\p{L}\\p{M}\\p{N}_])";
const RIGHT_TEXT_BOUNDARY = `(?=$|[^\\p{L}\\p{M}\\p{N}_]|[${JAPANESE_PARTICLE_CLASS}])`;

export function normalizeMemberDisplayText(value: string, members: MemberLinkTarget[]): string {
  if (!value || members.length === 0) return value;

  const surnameCounts = countMemberSurnames(members);
  const replacements = members
    .flatMap((member) => buildMemberNameReplacements(member, surnameCounts))
    .sort((a, b) => b.length - a.length);

  let normalized = value;
  for (const replacement of replacements) {
    normalized = normalized.replace(replacement.regex, (_match, prefix: string) => `${prefix}${replacement.codeName}`);
  }
  return normalized;
}

export function splitMemberLinkedText(value: string, members: MemberLinkTarget[]): MemberLinkedTextPart[] {
  if (!value || members.length === 0) return [value];

  const normalizedMembers = members
    .filter((member) => member.codeName.trim().length >= 2)
    .sort((a, b) => b.codeName.length - a.codeName.length);

  const parts: MemberLinkedTextPart[] = [];
  let cursor = 0;
  let textStart = 0;

  while (cursor < value.length) {
    const matched = normalizedMembers.find(
      (member) => value.startsWith(member.codeName, cursor) && isStandaloneMemberMention(value, cursor, member.codeName),
    );

    if (matched) {
      if (textStart < cursor) parts.push(value.slice(textStart, cursor));
      parts.push(matched);
      cursor += matched.codeName.length;
      textStart = cursor;
      continue;
    }

    cursor += codePointLengthAt(value, cursor);
  }

  if (textStart < value.length) parts.push(value.slice(textStart));
  return parts.length > 0 ? parts : [value];
}

function isStandaloneMemberMention(value: string, start: number, codeName: string) {
  const end = start + codeName.length;
  return isLeftMentionBoundary(value, start) && isRightMentionBoundary(value, end);
}

function isLeftMentionBoundary(value: string, start: number) {
  const previous = charBefore(value, start);
  return !previous || !WORDISH_CHAR_RE.test(previous);
}

function isRightMentionBoundary(value: string, end: number) {
  const next = charAt(value, end);
  if (!next || !WORDISH_CHAR_RE.test(next)) return true;
  if (JAPANESE_PARTICLE_CHARS.has(next)) return true;
  return JAPANESE_HONORIFIC_SUFFIXES.some((suffix) => value.startsWith(suffix, end));
}

function charBefore(value: string, index: number) {
  if (index <= 0) return "";
  const chars = Array.from(value.slice(0, index));
  return chars[chars.length - 1] ?? "";
}

function charAt(value: string, index: number) {
  if (index >= value.length) return "";
  return Array.from(value.slice(index))[0] ?? "";
}

function codePointLengthAt(value: string, index: number) {
  return charAt(value, index).length || 1;
}

function buildMemberNameReplacements(member: MemberLinkTarget, surnameCounts: Map<string, number>) {
  const codeName = member.codeName.trim();
  const memberName = member.memberName?.trim();
  if (!codeName || !memberName) return [];

  const aliases = new Map<string, { pattern: string; length: number; suffixRequired: boolean }>();
  const compactFullName = memberName.replace(/\s+/g, "");
  const flexibleFullName = memberName
    .split(/\s+/)
    .filter(Boolean)
    .map(escapeRegExp)
    .join("\\s*");
  const surname = memberName.split(/\s+/).filter(Boolean)[0] ?? "";

  if (compactFullName && compactFullName !== codeName) {
    aliases.set(`compact:${compactFullName}`, {
      pattern: escapeRegExp(compactFullName),
      length: compactFullName.length,
      suffixRequired: false,
    });
  }
  if (flexibleFullName && compactFullName !== codeName) {
    aliases.set(`full:${flexibleFullName}`, {
      pattern: flexibleFullName,
      length: compactFullName.length,
      suffixRequired: false,
    });
  }
  if (surname && surname.length >= 2 && surname !== codeName) {
    aliases.set(`surname:${surname}`, {
      pattern: escapeRegExp(surname),
      length: surname.length,
      suffixRequired: (surnameCounts.get(surname) ?? 0) !== 1,
    });
  }

  return [...aliases.values()].map((alias) => {
    const suffix = alias.suffixRequired
      ? `\\s*(?:${MEMBER_NAME_HONORIFIC_SUFFIXES.map(escapeRegExp).join("|")})`
      : `(?:\\s*(?:${MEMBER_NAME_HONORIFIC_SUFFIXES.map(escapeRegExp).join("|")}))?`;
    return {
      codeName,
      length: alias.length,
      regex: new RegExp(`${LEFT_TEXT_BOUNDARY}${alias.pattern}${suffix}${RIGHT_TEXT_BOUNDARY}`, "gu"),
    };
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countMemberSurnames(members: MemberLinkTarget[]) {
  const counts = new Map<string, number>();
  for (const member of members) {
    const surname = member.memberName?.trim().split(/\s+/).filter(Boolean)[0] ?? "";
    if (!surname || surname.length < 2) continue;
    counts.set(surname, (counts.get(surname) ?? 0) + 1);
  }
  return counts;
}
