"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RotateCcw, Send, X } from "lucide-react";
import { MarkdownView } from "@/components/cockpit/MarkdownView";
import TsukuyomiSprite, { type TsukuyomiAnimation } from "@/components/tsukuyomi/Sprite";

interface ManualTsukuyomiFloatProps {
  currentSlug?: string;
}

interface SourceRef {
  slug: string;
  number: string;
  title: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: SourceRef[];
}

interface AskResponse {
  reply?: string;
  error?: string;
  sources?: SourceRef[];
}

const FPS: Record<TsukuyomiAnimation, number> = {
  idle: 5,
  happy: 7,
  thinking: 5,
  wave: 7,
};

function protectManualIdentifiers(source: string) {
  return source.replace(/(^|[^`\\])\b([A-Za-z0-9]+(?:_[A-Za-z0-9]+)+)\b(?!`)/g, "$1`$2`");
}

export function ManualTsukuyomiFloat({ currentSlug }: ManualTsukuyomiFloatProps) {
  const [open, setOpen] = useState(false);
  const [animation, setAnimation] = useState<TsukuyomiAnimation>("idle");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "OSマニュアルの中から探して答えるよ。むずい言葉はかみ砕くから、画面名・テーブル名・運用ルールをそのまま聞いてね。",
    },
  ]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, open]);

  useEffect(() => {
    if (!open) return;
    setAnimation("wave");
    const timer = window.setTimeout(() => setAnimation("idle"), 1600);
    return () => window.clearTimeout(timer);
  }, [open]);

  const startFresh = () => {
    setMessages([
      {
        role: "assistant",
        content:
          "新しい質問きかせて。OSマニュアル本文を根拠にして、見に行く章リンクまで返すね。",
      },
    ]);
    setInput("");
  };

  const send = async () => {
    const question = input.trim();
    if (!question || busy) return;

    const userMessage: ChatMessage = { role: "user", content: question };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);
    setAnimation("thinking");
    let settledWithHappy = false;

    try {
      const response = await fetch("/api/manual/tsukuyomi/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          currentSlug: currentSlug ?? null,
          history: nextMessages.map(({ role, content }) => ({ role, content })),
        }),
      });
      const json = (await response.json().catch(() => ({}))) as AskResponse;
      if (!response.ok) {
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: json.error ? `Gemini 側でエラー: ${json.error}` : "ごめん、今は回答できなかった。",
          },
        ]);
        return;
      }
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: json.reply ?? "ごめん、回答を作れなかった。",
          sources: json.sources ?? [],
        },
      ]);
      settledWithHappy = true;
      setAnimation("happy");
      window.setTimeout(() => setAnimation("idle"), 1400);
    } catch (e) {
      setMessages((current) => [
        ...current,
        { role: "assistant", content: `通信に失敗した: ${String(e)}` },
      ]);
    } finally {
      setBusy(false);
      if (!settledWithHappy) setAnimation("idle");
    }
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-testid="manual-tsukuyomi-float"
          className="fixed bottom-5 right-5 z-[85] flex items-end gap-2 rounded-lg border border-cyan-300 bg-white/95 px-3 py-2 text-left shadow-2xl shadow-cyan-900/15 backdrop-blur transition-colors hover:border-cyan-400 hover:bg-cyan-50"
          aria-label="OSマニュアルをつくよみに質問する"
        >
          <TsukuyomiSprite animation={animation} fps={FPS[animation]} scale={0.68} flipX />
          <span className="mb-1 min-w-0">
            <span className="block text-sm font-black text-slate-950">つくよみに聞く</span>
            <span className="block text-[11px] font-semibold text-cyan-700">OSマニュアル限定</span>
          </span>
        </button>
      )}

      {open && (
        <div
          className="fixed bottom-4 right-4 z-[75] flex w-[min(420px,calc(100vw-2rem))] flex-col rounded-lg border border-slate-200 bg-white shadow-2xl"
          style={{ height: "min(620px, calc(100vh - 6rem))" }}
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-md bg-cyan-50">
                <span className="translate-y-1">
                  <TsukuyomiSprite animation={animation} fps={FPS[animation]} scale={0.38} flipX />
                </span>
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-black text-slate-950">つくよみ Manual Q&A</h2>
                <p className="truncate text-[11px] font-semibold text-slate-500">Gemini 実験版 / OSマニュアル限定</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={startFresh}
                className="grid size-8 place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950"
                aria-label="会話を初期化"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-8 place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950"
                aria-label="閉じる"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-3">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`max-w-[92%] rounded-lg border px-3 py-2 text-[13px] ${
                  message.role === "assistant"
                    ? "border-cyan-100 bg-white text-slate-900"
                    : "ml-auto border-slate-200 bg-slate-900 text-white"
                }`}
              >
                <div className={`mb-1 text-[10px] font-black ${message.role === "assistant" ? "text-cyan-700" : "text-slate-300"}`}>
                  {message.role === "assistant" ? "つくよみ" : "まさ"}
                </div>
                {message.role === "assistant" ? (
                  <MarkdownView source={protectManualIdentifiers(message.content)} tone="light" linkMode="manual" />
                ) : (
                  <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
                )}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
                    {message.sources.map((source) => (
                      <Link
                        key={source.slug}
                        href={`/manual/${encodeURIComponent(source.slug)}`}
                        className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-bold text-cyan-900 hover:bg-cyan-100"
                      >
                        {source.number} {source.title}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <div className="max-w-[82%] rounded-lg border border-cyan-100 bg-white px-3 py-2 text-xs font-bold text-slate-500">
                Gemini でマニュアルを読んでる...
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 bg-white p-3">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  void send();
                }
              }}
              rows={3}
              disabled={busy}
              placeholder="例: 支払通知書PDFを直す時はどこを見る？"
              className="w-full resize-none rounded-md border border-slate-200 px-2.5 py-2 text-sm text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-50"
            />
            <div className="mt-2 flex items-center justify-end">
              <button
                type="button"
                onClick={() => void send()}
                disabled={busy || !input.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-cyan-600 px-3 py-2 text-xs font-black text-white transition-colors hover:bg-cyan-700 disabled:opacity-40"
              >
                <Send className="size-3.5" aria-hidden="true" />
                送信
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
