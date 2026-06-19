export type MemberLinkTarget = {
  memberId: string;
  codeName: string;
};

export type MemberLinkedTextPart = string | MemberLinkTarget;

const WORDISH_CHAR_RE = /[\p{L}\p{M}\p{N}_]/u;
const JAPANESE_PARTICLE_CHARS = new Set(["は", "が", "を", "に", "へ", "と", "で", "の", "も", "や", "か"]);
const JAPANESE_HONORIFIC_SUFFIXES = ["さん", "氏", "先生", "くん", "ちゃん"];

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
