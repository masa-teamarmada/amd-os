"use client";

import { useEffect, useRef, useState } from "react";

const SHEET_W = 2304;
const SHEET_H = 512;
const FRAME_W = 128;
const FRAME_H = 128;

export type TsukuyomiAnimation = "idle" | "happy" | "thinking" | "wave";

const ANIMATIONS: Record<TsukuyomiAnimation, { row: number; frames: number }> = {
  idle: { row: 0, frames: 18 },
  happy: { row: 1, frames: 18 },
  thinking: { row: 2, frames: 18 },
  wave: { row: 3, frames: 18 },
};

export default function Sprite({
  animation,
  fps = 11,
  scale = 1,
  loop = true,
  onComplete,
  flipX = false,
}: {
  animation: TsukuyomiAnimation;
  fps?: number;
  scale?: number;
  loop?: boolean;
  onComplete?: () => void;
  flipX?: boolean;
}) {
  const { row, frames } = ANIMATIONS[animation];
  const [frame, setFrame] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    setFrame(0);
    let f = 0;
    const interval = window.setInterval(() => {
      f++;
      if (f >= frames) {
        if (loop) {
          f = 0;
        } else {
          window.clearInterval(interval);
          onCompleteRef.current?.();
          return;
        }
      }
      setFrame(f);
    }, 1000 / fps);
    return () => window.clearInterval(interval);
  }, [animation, fps, frames, loop]);

  const w = FRAME_W * scale;
  const h = FRAME_H * scale;

  return (
    <div
      style={{
        width: `${w}px`,
        height: `${h}px`,
        backgroundImage: "url(/tsukuyomi/sheet-v4.png)",
        backgroundPosition: `-${frame * w}px -${row * h}px`,
        backgroundSize: `${SHEET_W * scale}px ${SHEET_H * scale}px`,
        backgroundRepeat: "no-repeat",
        transform: flipX ? "scaleX(-1)" : undefined,
        imageRendering: "auto",
      }}
      aria-hidden
    />
  );
}
