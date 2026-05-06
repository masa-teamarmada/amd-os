"use client";

/**
 * @ で始まる入力中、AMD メンバー (project_members 経由でアサイン済) のコードネームを suggestion 表示。
 * 選択時に textarea のカーソル位置に @コードネーム を挿入。
 *
 * 保存形式: textarea の plain text にそのまま `@まさ` のように残る。
 * 表示形式: <MentionDisplay text={...} /> で `@まさ` 部分を青字 span 化。
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchAssignedAmdMembers, type AmdMemberLite } from "@/lib/venture-status-data";

interface Props {
  projectId: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}

export function MentionTextarea({
  projectId,
  value,
  onChange,
  placeholder,
  rows = 4,
  className = "",
  autoFocus,
  disabled,
}: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [members, setMembers] = useState<AmdMemberLite[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(0); // highlighted suggestion index

  useEffect(() => {
    fetchAssignedAmdMembers(projectId).then(setMembers);
  }, [projectId]);

  /** カーソル直前の "@xxx" を検出。あれば query 設定 + open。 */
  const updateMentionState = () => {
    const ta = ref.current;
    if (!ta) return;
    const pos = ta.selectionStart ?? 0;
    const upToCaret = value.slice(0, pos);
    // @ の直後から空白 / 改行 / @ までを query とみなす
    const m = upToCaret.match(/(^|[\s　])@([^\s@　]*)$/) || (upToCaret.startsWith("@") && pos === upToCaret.length ? ["@", "", upToCaret.slice(1)] : null);
    if (!m) {
      setOpen(false);
      return;
    }
    const q = (m[2] ?? "").toLowerCase();
    setQuery(q);
    setHi(0);
    setOpen(true);
  };

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return members.slice(0, 8);
    return members
      .filter((m) => m.code_name.toLowerCase().includes(q) || m.member_id.toLowerCase().includes(q))
      .slice(0, 8);
  }, [members, query]);

  const insertMention = (m: AmdMemberLite) => {
    const ta = ref.current;
    if (!ta) return;
    const pos = ta.selectionStart ?? 0;
    const before = value.slice(0, pos);
    const after = value.slice(pos);
    // before の末尾 @xxx を @code_name に置換
    const replaced = before.replace(/@([^\s@　]*)$/, `@${m.code_name}`);
    const next = replaced + after;
    onChange(next);
    setOpen(false);
    // カーソルを mention の直後に
    requestAnimationFrame(() => {
      const newPos = replaced.length;
      ta.focus();
      ta.setSelectionRange(newPos, newPos);
    });
  };

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          requestAnimationFrame(updateMentionState);
        }}
        onKeyDown={(e) => {
          if (open && filtered.length > 0) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHi((h) => Math.min(filtered.length - 1, h + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHi((h) => Math.max(0, h - 1));
            } else if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              insertMention(filtered[hi]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }
        }}
        onClick={updateMentionState}
        onKeyUp={(e) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) updateMentionState();
        }}
        rows={rows}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        className={className}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 left-2 bg-white border border-[#e5e5e7] shadow-md rounded-md text-[12px] min-w-[160px] max-h-[200px] overflow-y-auto">
          <div className="px-2 py-1 text-[10px] text-muted-foreground border-b border-[#f1f5f9]">
            ↑↓で選択 / Enter で挿入
          </div>
          {filtered.map((m, i) => (
            <button
              key={m.member_id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertMention(m)}
              className={`block w-full text-left px-2 py-1 ${
                i === hi ? "bg-blue-50 text-blue-900" : "hover:bg-[#fafafa]"
              }`}
            >
              <span className="text-blue-600 font-mono">@{m.code_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** 表示用: テキスト中の @コードネーム を青字に。 */
export function MentionDisplay({
  text,
  className = "",
}: {
  text: string | null | undefined;
  className?: string;
}) {
  if (!text) return null;
  // @ の直後 (空白/@以外) を mention とみなす
  const parts = text.split(/(@[^\s@　]+)/g);
  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.startsWith("@") ? (
          <span key={i} className="text-blue-600 font-medium">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </span>
  );
}
