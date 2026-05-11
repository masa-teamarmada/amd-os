"use client";

import { useEffect, useRef, useState } from "react";
import TsukuyomiSprite, { type TsukuyomiAnimation } from "./Sprite";
import { TsukuyomiChatDrawer } from "./TsukuyomiChatDrawer";

const CORNER_SCALE = 0.9;
const CORNER_BOTTOM_PX = 16;

const MOOD_MIN_MS = 30_000;
const MOOD_MAX_MS = 90_000;
const MOOD_DURATION_MS = 1800;

const FPS: Record<TsukuyomiAnimation, number> = {
  idle: 5,
  happy: 7,
  thinking: 5,
  wave: 7,
};

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function pickMood(): TsukuyomiAnimation {
  const moods: TsukuyomiAnimation[] = ["happy", "thinking", "wave"];
  return moods[Math.floor(Math.random() * moods.length)];
}

export default function Mascot() {
  const [animation, setAnimation] = useState<TsukuyomiAnimation>("idle");
  const animationRef = useRef<TsukuyomiAnimation>("idle");
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    animationRef.current = animation;
  }, [animation]);

  // periodic mood swap (idle → happy/thinking/wave → idle)
  useEffect(() => {
    let moodTimer: number | null = null;
    let resetTimer: number | null = null;

    function scheduleMood() {
      moodTimer = window.setTimeout(() => {
        if (
          animationRef.current === "idle" &&
          document.visibilityState === "visible"
        ) {
          const mood = pickMood();
          setAnimation(mood);
          resetTimer = window.setTimeout(() => {
            setAnimation("idle");
            scheduleMood();
          }, MOOD_DURATION_MS);
        } else {
          scheduleMood();
        }
      }, rand(MOOD_MIN_MS, MOOD_MAX_MS));
    }

    scheduleMood();
    return () => {
      if (moodTimer !== null) window.clearTimeout(moodTimer);
      if (resetTimer !== null) window.clearTimeout(resetTimer);
    };
  }, []);

  function handleTap() {
    setAnimation("wave");
    window.setTimeout(() => setAnimation("idle"), MOOD_DURATION_MS);
    setChatOpen(true);
  }

  // 外部からチャット起動 + prefill を要求するイベント。
  // window.dispatchEvent(new CustomEvent("tsukuyomi:open", { detail: { message: "..." } })) で発火。
  // 受け取った message は localStorage に置き、Drawer mount 時に読み込まれる。
  // (Drawer はマウント直後に "tsukuyomi:pending-prefill" を読んで input に挿入する)
  useEffect(() => {
    function onOpenRequest(e: Event) {
      const ce = e as CustomEvent<{ message?: string }>;
      const msg = ce.detail?.message;
      if (typeof msg === "string" && msg.length > 0) {
        try {
          window.localStorage.setItem("tsukuyomi:pending-prefill", msg);
        } catch {
          /* ignore */
        }
      }
      setChatOpen(true);
      setAnimation("wave");
      window.setTimeout(() => setAnimation("idle"), MOOD_DURATION_MS);
    }
    window.addEventListener("tsukuyomi:open", onOpenRequest);
    return () => window.removeEventListener("tsukuyomi:open", onOpenRequest);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={handleTap}
        className="fixed right-2 z-30 opacity-95 active:opacity-70 transition-opacity"
        style={{ bottom: `${CORNER_BOTTOM_PX}px` }}
        aria-label="つくよみと話す"
      >
        <TsukuyomiSprite
          animation={animation}
          fps={FPS[animation]}
          scale={CORNER_SCALE}
          flipX
        />
        {/* 右下足元に「今週の累積コスト (円)」を小さく表示。まさ要望 2026-05-11。 */}
        <TsukuyomiWeeklyCost />
      </button>
      {chatOpen && <TsukuyomiChatDrawer onClose={() => setChatOpen(false)} />}
    </>
  );
}

// 直近 7 日のつくよみコスト (円) を 60 秒毎に取得して表示する小さい数字。
function TsukuyomiWeeklyCost() {
  const [jpy, setJpy] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data } = await supabase
          .from("tsukuyomi_usage_log")
          .select("cost_jpy")
          .gte("created_at", since);
        if (cancelled) return;
        const total = (data ?? []).reduce(
          (s: number, r: { cost_jpy: number | null }) => s + (Number(r.cost_jpy) || 0),
          0
        );
        setJpy(total);
      } catch {
        // ignore
      }
    };
    load();
    const t = setInterval(load, 60 * 1000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);
  if (jpy == null) return null;
  const fmt = jpy >= 1000 ? `${(jpy / 1000).toFixed(1)}k¥` : `${Math.round(jpy)}¥`;
  return (
    <span
      className="pointer-events-none absolute bottom-0 right-0 text-[10px] font-mono text-amber-700 bg-white/85 backdrop-blur-sm rounded px-1.5 leading-tight shadow-sm"
      title={`直近 7 日のつくよみ累積コスト: ¥${jpy.toFixed(2)}`}
    >
      {fmt}/週
    </span>
  );
}
