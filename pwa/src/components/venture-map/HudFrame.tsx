"use client";

import type { CSSProperties, ReactNode } from "react";

// ============================================================
// HudFrame: 画像背景の cyber HUD フレーム
//
// `pwa/public/hud-frames/cyber-frame.png` (1600×872、装飾は四辺のみ、
//  中央は透過) を `background-image` で stretch する。
//
// 画像生成は Codex 側 (まさが Gemini で生成) で行う。
// ここで SVG / CSS で装飾を自作してはいけない (AGENTS.md ルール)。
// ============================================================

const FRAME_URL = "/hud-frames/cyber-frame.png";

interface Props {
  children: ReactNode;
  variant?: "default" | "compact" | "modal";
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
  // padding (中央コンテンツの余白) を variant 別に
  const defaultPadding =
    variant === "compact"
      ? "16px 32px"
      : variant === "modal"
        ? "32px 48px"
        : "20px 36px";

  return (
    <div
      className={className}
      style={{
        position: "relative",
        backgroundImage: `url(${FRAME_URL})`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        // 画像の中央は透過なので、奥に半透明白を敷いて文字の可読性を確保
        ...style,
      }}
    >
      {/* 中央透過部分の下敷き (画像装飾より下、children より下) */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: variant === "compact" ? "10%" : "8%",
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
