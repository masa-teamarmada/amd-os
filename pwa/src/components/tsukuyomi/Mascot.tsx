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
      </button>
      {chatOpen && <TsukuyomiChatDrawer onClose={() => setChatOpen(false)} />}
    </>
  );
}
