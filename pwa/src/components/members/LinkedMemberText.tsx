"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { splitMemberLinkedText } from "@/lib/member-linking";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type MemberLinkRow = {
  memberId: string;
  codeName: string;
};

type LinkedMemberTextProps = {
  text: string | null | undefined;
  className?: string;
  linkClassName?: string;
};

let cachedMembers: MemberLinkRow[] | null = null;
let loadPromise: Promise<MemberLinkRow[]> | null = null;

function normalizeMembers(rows: Array<{ member_id: string | null; code_name: string | null }>) {
  const byCodeName = new Map<string, MemberLinkRow>();
  for (const row of rows) {
    const memberId = row.member_id?.trim();
    const codeName = row.code_name?.trim();
    if (!memberId || !codeName) continue;
    if (codeName.length < 2) continue;
    if (!byCodeName.has(codeName)) byCodeName.set(codeName, { memberId, codeName });
  }
  return [...byCodeName.values()].sort((a, b) => b.codeName.length - a.codeName.length);
}

async function loadMembers() {
  if (cachedMembers) return cachedMembers;
  if (!loadPromise) {
    loadPromise = (async () => {
      const { data, error } = await createClient()
        .from("members")
        .select("member_id, code_name")
        .eq("status", "active");
        if (error) throw error;
        cachedMembers = normalizeMembers(data ?? []);
        return cachedMembers;
      })()
      .catch((error: unknown) => {
        console.warn("[LinkedMemberText] members load failed:", error);
        const fallback: MemberLinkRow[] = [];
        cachedMembers = fallback;
        return fallback;
      });
  }
  return loadPromise;
}

export function LinkedMemberText({ text, className, linkClassName }: LinkedMemberTextProps) {
  const value = String(text ?? "");
  const [members, setMembers] = useState<MemberLinkRow[]>(cachedMembers ?? []);

  useEffect(() => {
    let alive = true;
    void loadMembers().then((rows) => {
      if (alive) setMembers(rows);
    });
    return () => {
      alive = false;
    };
  }, []);

  const parts = useMemo(() => {
    if (!value || members.length === 0) return [value];
    return splitMemberLinkedText(value, members);
  }, [members, value]);

  if (!value) return null;

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (typeof part === "string") return <span key={`${index}-text`}>{part}</span>;
        return (
          <Link
            key={`${part.memberId}-${index}`}
            href={`/mypage?memberId=${encodeURIComponent(part.memberId)}`}
            className={cn("font-medium text-[#007aff] underline-offset-2 hover:underline", linkClassName)}
          >
            {part.codeName}
          </Link>
        );
      })}
    </span>
  );
}
