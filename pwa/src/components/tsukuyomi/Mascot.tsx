"use client";

import { useEffect, useRef, useState } from "react";
import TsukuyomiSprite, { type TsukuyomiAnimation } from "./Sprite";

const CORNER_SCALE = 0.7;
const WALK_SCALE = 1.0;
const WALK_DURATION_MS = 8000;
const WALK_BOTTOM_PX = 24;
const FRAME_W = 168;

const NEXT_WALK_MIN_MS = 60_000;
const NEXT_WALK_MAX_MS = 180_000;
const FIRST_WALK_MIN_MS = 20_000;
const FIRST_WALK_MAX_MS = 60_000;

type Mode = "corner" | "walking";

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export default function Mascot() {
  const [mode, setMode] = useState<Mode>("corner");
  const [animation, setAnimation] = useState<TsukuyomiAnimation>("idle");
  const [walkX, setWalkX] = useState(0);
  const tapResetTimerRef = useRef<number | null>(null);
  const modeRef = useRef<Mode>("corner");

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    let walkTimer: number | null = null;
    let rafId: number | null = null;

    function startWalk() {
      const sheetW = FRAME_W * WALK_SCALE;
      const screenW = window.innerWidth;
      const goRight = Math.random() < 0.5;
      const startX = goRight ? -sheetW : screenW;
      const endX = goRight ? screenW : -sheetW;

      setAnimation(goRight ? "running-right" : "running-left");
      setWalkX(startX);
      setMode("walking");

      const startTime = performance.now();
      const step = (now: number) => {
        const t = Math.min((now - startTime) / WALK_DURATION_MS, 1);
        setWalkX(startX + (endX - startX) * t);
        if (t < 1) {
          rafId = requestAnimationFrame(step);
        } else {
          rafId = null;
          setMode("corner");
          setAnimation("idle");
          scheduleNext(rand(NEXT_WALK_MIN_MS, NEXT_WALK_MAX_MS));
        }
      };
      rafId = requestAnimationFrame(step);
    }

    function scheduleNext(delay: number) {
      walkTimer = window.setTimeout(() => {
        if (
          document.visibilityState === "visible" &&
          modeRef.current === "corner"
        ) {
          startWalk();
        } else {
          scheduleNext(rand(NEXT_WALK_MIN_MS, NEXT_WALK_MAX_MS));
        }
      }, delay);
    }

    scheduleNext(rand(FIRST_WALK_MIN_MS, FIRST_WALK_MAX_MS));

    return () => {
      if (walkTimer !== null) window.clearTimeout(walkTimer);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (tapResetTimerRef.current !== null)
        window.clearTimeout(tapResetTimerRef.current);
    };
  }, []);

  function handleTap() {
    if (mode === "walking") return;
    if (animation === "waving") return;
    setAnimation("waving");
    if (tapResetTimerRef.current !== null)
      window.clearTimeout(tapResetTimerRef.current);
    tapResetTimerRef.current = window.setTimeout(() => {
      setAnimation("idle");
    }, 1500);
  }

  if (mode === "walking") {
    return (
      <div
        className="pointer-events-none fixed z-30"
        style={{
          left: `${walkX}px`,
          bottom: `${WALK_BOTTOM_PX}px`,
        }}
        aria-hidden
      >
        <TsukuyomiSprite animation={animation} fps={12} scale={WALK_SCALE} />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleTap}
      className="fixed right-1 z-30 opacity-90 active:opacity-60 transition-opacity"
      style={{ bottom: `${WALK_BOTTOM_PX}px` }}
      aria-label="つくよみ"
    >
      <TsukuyomiSprite
        animation={animation}
        fps={animation === "waving" ? 8 : 6}
        scale={CORNER_SCALE}
      />
    </button>
  );
}
