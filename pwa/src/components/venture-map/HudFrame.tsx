"use client";

import type { CSSProperties, ReactNode } from "react";

// ============================================================
// HudFrame: 画像背景の cyber HUD フレーム
//
// 背景画像 (Codex/Gemini で生成、まさが用意):
//   - cyber-frame.png      1600×872  (1.83:1)  modal / default
//   - cyber-frame-bar.png  2400×480  (5:1)     bar (header / panel)
//
// SVG / CSS で装飾を自作してはいけない (AGENTS.md 画像生成ごまかし禁止)。
// ============================================================

const FRAME_MODAL = "/hud-frames/cyber-frame.png";
const FRAME_BAR = "/hud-frames/cyber-frame-bar.png";

interface Props {
  children: ReactNode;
  variant?: "default" | "compact" | "modal" | "bar";
  style?: CSSProperties;
  className?: string;
  padding?: number | string;
}

export function HudFrame({
  children,
  variant = "default",
  style,
  className,
  padding,
}: Props) {
  const isBar = variant === "bar";
  const frameUrl = isBar ? FRAME_BAR : FRAME_MODAL;

  // padding (中央コンテンツの余白) を variant 別に
  const defaultPadding = isBar
    ? "8px 70px" // bar: 左右の cyan glow ブラケット部分を避ける
    : variant === "compact"
      ? "16px 32px"
      : variant === "modal"
        ? "32px 48px"
        : "20px 36px";

  // 中央透過部分の下敷きの inset (画像の枠デザインに合わせて)
  const insetUnderlay = isBar ? "10% 8%" : "8%";

  return (
    <div
      className={className}
      style={{
        position: "relative",
        backgroundImage: `url(${frameUrl})`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        ...style,
      }}
    >
      {/* 中央透過部分の下敷き (画像の透過範囲に半透明白を敷いて文字可読性確保) */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: insetUnderlay,
          background: "rgba(255,255,255,0.78)",
          backdropFilter: "blur(8px) saturate(140%)",
          WebkitBackdropFilter: "blur(8px) saturate(140%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: padding ?? defaultPadding,
        }}
      >
        {children}
      </div>
    </div>
  );
}
