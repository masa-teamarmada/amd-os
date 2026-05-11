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
import { createClient } from "@/lib/supabase/client";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  attachments?: AttachedFile[];   // user メッセージのみ
}

export interface AttachedFile {
  name: string;
  mediaType: string;             // "image/png" | "application/pdf" | "text/plain" 等
  size: number;
  data: string;                  // base64 (no data: prefix)
}

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;   // 8 MB / file (Sonnet image 5MB / PDF 32MB の中間)
const MAX_ATTACHMENTS_PER_TURN = 5;
const ACCEPTED_MEDIA = "image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/markdown,text/csv";

async function fileToAttached(file: File): Promise<AttachedFile> {
  const buf = await file.arrayBuffer();
  // base64 化 (大きいファイルでも一度に処理可能)
  let bin = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  const data = btoa(bin);
  return {
    name: file.name,
    mediaType: file.type || "application/octet-stream",
    size: file.size,
    data,
  };
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)}KB`;
  return `${(b / (1024 * 1024)).toFixed(1)}MB`;
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
  const m =
    pathname.match(/\/project\/([^\/]+)\/cockpit/) ||
    pathname.match(/\/project\/([^\/]+)\/config/) ||
    pathname.match(/\/venture-map\/su\/([^\/]+)/) ||
    pathname.match(/\/venture-map\/amd-score\/([^\/]+)/);
  return m ? m[1] : null;
}

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** localStorage に保存するチャット状態。
 *  ブラウザのキャッシュがある限り、別タップで閉じても会話が続く。
 *  PJ ごとに分けたいので、project_id (or 'no_project') ごとに保存する。 */
const LS_VERSION = "v1";
const LS_PREFIX = "tsukuyomi_chat";

interface PersistedChat {
  sessionId: string;
  messages: ChatMessage[];
  appliedSummary: ApplyAction[];
  updatedAt: string;
}

function lsKey(projectId: string | null): string {
  return `${LS_PREFIX}:${LS_VERSION}:${projectId ?? "no_project"}`;
}

function loadPersisted(projectId: string | null): PersistedChat | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(lsKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.sessionId || !Array.isArray(parsed.messages)) return null;
    // ★ 1 時間以上前の chat は「残骸」なので破棄 (まさ要望 2026-05-11)。
    //   appliedSummary も同じく古ければ表示しない。
    if (parsed.updatedAt) {
      const ageMs = Date.now() - new Date(parsed.updatedAt).getTime();
      if (Number.isFinite(ageMs) && ageMs > 60 * 60 * 1000) {
        window.localStorage.removeItem(lsKey(projectId));
        return null;
      }
    }
    return {
      sessionId: parsed.sessionId,
      messages: parsed.messages,
      // appliedSummary は drawer を 1 度閉じたら復元しない (= 残骸を見せない)
      appliedSummary: [],
      updatedAt: parsed.updatedAt ?? "",
    };
  } catch {
    return null;
  }
}

function savePersisted(projectId: string | null, state: PersistedChat) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(lsKey(projectId), JSON.stringify(state));
  } catch {
    // localStorage が満杯 / 無効な環境では諦める
  }
}

function clearPersisted(projectId: string | null) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(lsKey(projectId));
  } catch {
    // ignore
  }
}

interface Props {
  onClose: () => void;
}

export function TsukuyomiChatDrawer({ onClose }: Props) {
  const pathname = usePathname();
  const projectId = extractProjectId(pathname);

  // 初回 mount 時に localStorage から復元 (なければ greeting + 新 session)
  const initial = (() => {
    const persisted = loadPersisted(projectId);
    if (persisted && persisted.messages.length > 0) {
      return persisted;
    }
    return {
      sessionId: uuid(),
      messages: [
        {
          role: "assistant" as const,
          content: projectId
            ? `この PJ コックピットで何が知りたい? 修正したいことがあれば直接言ってくれれば直します。`
            : `何を見て、何を直しましょうか? PJ コックピットを開きながら話しかけると、その PJ の情報を直接修正できます。`,
        },
      ],
      appliedSummary: [] as ApplyAction[],
      updatedAt: new Date().toISOString(),
    };
  })();

  const [messages, setMessages] = useState<ChatMessage[]>(initial.messages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [appliedSummary, setAppliedSummary] = useState<ApplyAction[]>(initial.appliedSummary);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  // ログイン中ユーザーの code_name (ハードコードしない、各ユーザーで異なる)
  const [userCodeName, setUserCodeName] = useState<string>("あなた");
  const sessionIdRef = useRef<string>(initial.sessionId);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const email = user?.email?.toLowerCase();
        if (!email) return;
        const { data: member } = await supabase
          .from("members")
          .select("code_name")
          .eq("email", email)
          .maybeSingle();
        if (!cancelled && member?.code_name) setUserCodeName(member.code_name);
      } catch {
        /* silent */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 状態が変わるたび localStorage に保存 → ブラウザを閉じる / 別ページに行っても会話を継続
  useEffect(() => {
    savePersisted(projectId, {
      sessionId: sessionIdRef.current,
      messages,
      appliedSummary,
      updatedAt: new Date().toISOString(),
    });
  }, [messages, appliedSummary, projectId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  // 外部 (例: AMD Score 詳細ページの軸クリック) から prefill メッセージを送り込む。
  // window.dispatchEvent(new CustomEvent("tsukuyomi:prefill", { detail: { message: "..." } })) で発火。
  // Drawer 起動時の prefill は Mascot 側で localStorage を介して受け取り、ここでも同じ key を読む。
  useEffect(() => {
    function onPrefill(e: Event) {
      const ce = e as CustomEvent<{ message?: string }>;
      const msg = ce.detail?.message;
      if (typeof msg === "string" && msg.length > 0) {
        setInput((prev) => (prev ? prev + "\n" + msg : msg));
      }
    }
    window.addEventListener("tsukuyomi:prefill", onPrefill);
    return () => window.removeEventListener("tsukuyomi:prefill", onPrefill);
  }, []);

  // Drawer 起動時 (open 直後) に localStorage の prefill を読む
  useEffect(() => {
    try {
      const pending = window.localStorage.getItem("tsukuyomi:pending-prefill");
      if (pending) {
        setInput((prev) => (prev ? prev + "\n" + pending : pending));
        window.localStorage.removeItem("tsukuyomi:pending-prefill");
      }
    } catch {
      /* ignore */
    }
  }, []);

  const startFreshSession = () => {
    if (!confirm("会話を初期化しますか? (履歴は admin/tsukuyomi に残ります)")) return;
    sessionIdRef.current = uuid();
    setMessages([
      {
        role: "assistant",
        content: projectId
          ? `この PJ コックピットで何が知りたい? 修正したいことがあれば直接言ってくれれば直します。`
          : `何を見て、何を直しましょうか? PJ コックピットを開きながら話しかけると、その PJ の情報を直接修正できます。`,
      },
    ]);
    setAppliedSummary([]);
    clearPersisted(projectId);
  };

  const onPickFiles = async (files: FileList | null) => {
    if (!files) return;
    setAttachError(null);
    const next: AttachedFile[] = [...attachments];
    for (const file of Array.from(files)) {
      if (next.length >= MAX_ATTACHMENTS_PER_TURN) {
        setAttachError(`添付は最大 ${MAX_ATTACHMENTS_PER_TURN} ファイルまで`);
        break;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setAttachError(`${file.name} は ${formatBytes(file.size)} で大きすぎ (上限 ${formatBytes(MAX_ATTACHMENT_BYTES)})`);
        continue;
      }
      try {
        next.push(await fileToAttached(file));
      } catch (e) {
        setAttachError(`${file.name} 読み込み失敗: ${String(e)}`);
      }
    }
    setAttachments(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (idx: number) => {
    setAttachments(attachments.filter((_, i) => i !== idx));
  };

  const send = async () => {
    if ((!input.trim() && attachments.length === 0) || busy) return;
    const userMsg = input.trim();
    const sentAttachments = attachments;
    setInput("");
    setAttachments([]);
    setBusy(true);
    const newMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: userMsg, attachments: sentAttachments.length > 0 ? sentAttachments : undefined },
    ];
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
    <>
      {/* 背景クリックで閉じる (透明 — マスコットは隠さない) */}
      <div className="fixed inset-0 z-[65]" onClick={onClose} />
      {/* マスコットの上に吹き出し風で表示。
         右端 = マスコットの右端揃え (right: 8px、マスコットも right-2)
         下端 = マスコット高さ (~140px) + 余白 */}
      <div
        className="fixed right-2 z-[70] bg-white shadow-2xl flex flex-col rounded-2xl rounded-br-sm border border-[#e5e5e7]"
        style={{
          bottom: "168px",
          width: "min(380px, 92vw)",
          height: "min(540px, calc(100vh - 200px))",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 吹き出しのしっぽ */}
        <div
          className="absolute right-6 -bottom-2 w-4 h-4 bg-white border-r border-b border-[#e5e5e7]"
          style={{ transform: "rotate(45deg)" }}
        />

        <div className="px-3 py-2 border-b border-[#e5e5e7] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🌙</span>
            <h3 className="text-[13px] font-semibold">つくよみと話す</h3>
            {projectId && (
              <span className="text-[10px] font-mono text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                {projectId}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={startFreshSession}
              className="text-[10px] text-muted-foreground hover:text-foreground hover:underline"
              title="会話を初期化 (履歴は admin/tsukuyomi に残る)"
            >
              新しい会話
            </button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">
              ✕
            </button>
          </div>
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
                {m.role === "assistant" ? "つくよみ" : userCodeName}
              </div>
              {m.content}
              {m.attachments && m.attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.attachments.map((a, ai) => (
                    <div
                      key={ai}
                      className="text-[10px] px-2 py-1 rounded bg-white/60 border border-slate-200 flex items-center gap-1"
                    >
                      <span>{a.mediaType.startsWith("image/") ? "🖼" : a.mediaType === "application/pdf" ? "📄" : "📎"}</span>
                      <span className="font-mono">{a.name}</span>
                      <span className="text-slate-500">{formatBytes(a.size)}</span>
                    </div>
                  ))}
                </div>
              )}
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

        <div
          className="px-4 py-3 border-t border-[#e5e5e7] flex flex-col gap-2"
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            void onPickFiles(e.dataTransfer.files);
          }}
        >
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {attachments.map((a, i) => (
                <div
                  key={i}
                  className="text-[10px] px-2 py-1 rounded bg-slate-100 border border-slate-200 flex items-center gap-1"
                >
                  <span>{a.mediaType.startsWith("image/") ? "🖼" : a.mediaType === "application/pdf" ? "📄" : "📎"}</span>
                  <span className="font-mono">{a.name}</span>
                  <span className="text-slate-500">{formatBytes(a.size)}</span>
                  <button
                    onClick={() => removeAttachment(i)}
                    className="ml-1 text-slate-400 hover:text-slate-700"
                    aria-label="削除"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          {attachError && (
            <div className="text-[10px] text-red-600">{attachError}</div>
          )}
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
                ? "例: 概要を「最新の量産進捗込み」で書き直して / 沿革の○○を直して / [📎 で資料を添付してから「これ反映して」]"
                : "PJ コックピットを開いてから話すと、その PJ の情報を直接修正できます"
            }
            rows={3}
            disabled={busy}
            className="border border-[#e5e5e7] rounded-md px-2 py-1.5 text-[13px] disabled:bg-[#fafafa]"
          />
          <div className="flex items-center justify-between gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_MEDIA}
              onChange={(e) => void onPickFiles(e.target.files)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy || attachments.length >= MAX_ATTACHMENTS_PER_TURN}
              className="text-[12px] px-2 py-1.5 rounded-md border border-slate-300 hover:bg-slate-50 disabled:opacity-40"
              title="画像 / PDF / テキストを添付 (ドラッグ&ドロップも可)"
            >
              📎 添付
            </button>
            <button
              onClick={send}
              disabled={busy || (!input.trim() && attachments.length === 0)}
              className="text-[12px] px-3 py-1.5 rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40"
            >
              送信 (⌘+Enter)
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
