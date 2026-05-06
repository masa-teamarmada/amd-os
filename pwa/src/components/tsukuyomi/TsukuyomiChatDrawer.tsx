"use client";

/**
 * 右下のつくよみマスコットをタップして開くチャット drawer。
 *
 * - 画面の URL から projectId を抽出 (cockpit / venture-map/su など)
 * - 各ターン: 履歴 + 画面 context を Sonnet に渡す
 * - Sonnet が tool 呼んで修正適用 (今のところは short/long_description, narrative_invalidate)
 * - 全会話は tsukuyomi_chat_logs に保存 → admin/tsukuyomi で見える
 */

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ApplyAction {
  kind: string;
  detail: string;
}

interface TurnResponse {
  reply: string;
  applied?: ApplyAction[];
}

function extractProjectId(pathname: string | null): string | null {
  if (!pathname) return null;
  const m = pathname.match(/\/project\/([^\/]+)\/cockpit/) ||
            pathname.match(/\/venture-map\/su\/([^\/]+)/);
  return m ? m[1] : null;
}

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface Props {
  onClose: () => void;
}

export function TsukuyomiChatDrawer({ onClose }: Props) {
  const pathname = usePathname();
  const projectId = extractProjectId(pathname);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: projectId
        ? `この PJ コックピットで何が知りたい? 修正したいことがあれば直接言ってくれれば直します。`
        : `何を見て、何を直しましょうか? PJ コックピットを開きながら話しかけると、その PJ の情報を直接修正できます。`,
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [appliedSummary, setAppliedSummary] = useState<ApplyAction[]>([]);
  const sessionIdRef = useRef<string>(uuid());
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async () => {
    if (!input.trim() || busy) return;
    const userMsg = input.trim();
    setInput("");
    setBusy(true);
    const newMessages: ChatMessage[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);

    try {
      const res = await fetch("/api/tsukuyomi/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionIdRef.current,
          page_path: pathname ?? null,
          project_id: projectId,
          messages: newMessages,
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        setMessages((m) => [
          ...m,
          { role: "assistant", content: `ごめん、エラーで返事できなかった。${errText.slice(0, 200)}` },
        ]);
      } else {
        const json: TurnResponse = await res.json();
        setMessages((m) => [...m, { role: "assistant", content: json.reply }]);
        if (json.applied && json.applied.length > 0) {
          setAppliedSummary((prev) => [...prev, ...json.applied!]);
        }
      }
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `通信失敗: ${String(e)}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        className="absolute right-0 top-0 bottom-0 w-[420px] max-w-[92vw] bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[#e5e5e7] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🌙</span>
            <h3 className="text-sm font-semibold">つくよみと話す</h3>
            {projectId && (
              <span className="text-[10px] font-mono text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                {projectId}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">
            ✕
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 bg-[#fafbff]">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[88%] text-[12.5px] px-3 py-2 rounded-2xl whitespace-pre-wrap ${
                m.role === "assistant"
                  ? "self-start bg-purple-50 text-purple-900 rounded-bl-sm"
                  : "self-end bg-slate-100 text-slate-900 rounded-br-sm"
              }`}
            >
              <div className="text-[10px] mb-0.5 opacity-60">
                {m.role === "assistant" ? "つくよみ" : "まさ"}
              </div>
              {m.content}
            </div>
          ))}
          {busy && (
            <div className="self-start text-[11px] text-muted-foreground italic">考えてます…</div>
          )}
          {appliedSummary.length > 0 && (
            <div className="self-start max-w-[92%] bg-emerald-50 text-emerald-900 text-[11px] px-3 py-2 rounded-md">
              <div className="text-[10px] text-emerald-700 mb-1">✓ 修正を適用しました</div>
              <ul className="list-disc list-inside">
                {appliedSummary.map((a, i) => (
                  <li key={i}>
                    <strong>{a.kind}</strong>: {a.detail}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-[#e5e5e7] flex flex-col gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={
              projectId
                ? "例: 概要を「最新の量産進捗込み」で書き直して / 沿革の○○を直して"
                : "PJ コックピットを開いてから話すと、その PJ の情報を直接修正できます"
            }
            rows={3}
            disabled={busy}
            className="border border-[#e5e5e7] rounded-md px-2 py-1.5 text-[13px] disabled:bg-[#fafafa]"
          />
          <div className="flex justify-end">
            <button
              onClick={send}
              disabled={busy || !input.trim()}
              className="text-[12px] px-3 py-1.5 rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40"
            >
              送信 (⌘+Enter)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
