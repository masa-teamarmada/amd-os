"use client";

import { useEffect, useRef, useState } from "react";

const SHEET_W = 1344;
const SHEET_H = 1170;
const FRAME_W = 168;
const FRAME_H = 110;

const ROW_TOP_Y = [28, 169, 307, 444, 583, 715, 856, 996] as const;

export type TsukuyomiAnimation =
  | "idle"
  | "running-right"
  | "running-left"
  | "waving"
  | "jumping"
  | "failed"
  | "running"
  | "review";

const ANIMATIONS: Record<TsukuyomiAnimation, { row: number; frames: number }> = {
  idle: { row: 0, frames: 7 },
  "running-right": { row: 1, frames: 7 },
  "running-left": { row: 2, frames: 7 },
  waving: { row: 3, frames: 6 },
  jumping: { row: 4, frames: 7 },
  failed: { row: 5, frames: 7 },
  running: { row: 6, frames: 7 },
  review: { row: 7, frames: 7 },
};

export default function Sprite({
  animation,
  fps = 8,
  scale = 1,
  loop = true,
  onComplete,
}: {
  animation: TsukuyomiAnimation;
  fps?: number;
  scale?: number;
  loop?: boolean;
  onComplete?: () => void;
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
  const offsetY = ROW_TOP_Y[row] * scale;

  return (
    <div
      style={{
        width: `${w}px`,
        height: `${h}px`,
        backgroundImage: "url(/tsukuyomi/sheet.png)",
        backgroundPosition: `-${frame * w}px -${offsetY}px`,
        backgroundSize: `${SHEET_W * scale}px ${SHEET_H * scale}px`,
        backgroundRepeat: "no-repeat",
      }}
      aria-hidden
    />
  );
}
