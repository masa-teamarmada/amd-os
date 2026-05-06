"use client";

import type { CSSProperties, ReactNode } from "react";

// ============================================================
// HudFrame: SVG ベースのサイバー HUD フレーム
// 画像生成ツールの代替として SVG で角落ち・tick・arrow・arc を描く
// children を中央に配置し、SVG はフレーム装飾として背景に流す
// ============================================================

interface Props {
  children: ReactNode;
  variant?: "default" | "compact" | "modal";
  accent?: string; // ライン色 (default: black-ish)
  glow?: string;   // 装飾アクセント色
  style?: CSSProperties;
  className?: string;
  padding?: number | string;
}

export function HudFrame({
  children,
  variant = "default",
  accent = "#0a0e15",
  glow = "#22d3ee",
  style,
  className,
  padding,
}: Props) {
  const cornerCut = variant === "compact" ? 10 : variant === "modal" ? 18 : 14;

  return (
    <div
      className={className}
      style={{
        position: "relative",
        background: "rgba(255,255,255,0.78)",
        backdropFilter: "blur(10px) saturate(140%)",
        WebkitBackdropFilter: "blur(10px) saturate(140%)",
        clipPath: `polygon(${cornerCut}px 0, 100% 0, 100% calc(100% - ${cornerCut}px), calc(100% - ${cornerCut}px) 100%, 0 100%, 0 ${cornerCut}px)`,
        boxShadow: `0 4px 20px ${glow}1f, inset 0 0 0 1px ${accent}`,
        padding: padding ?? "10px 16px",
        ...style,
      }}
    >
      {/* SVG decoration overlay */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          opacity: 0.55,
        }}
      >
        {/* top-right tick stripes (3 angled) */}
        <g stroke={accent} strokeWidth="0.4" fill="none">
          <line x1="78" y1="2" x2="92" y2="2" />
          <line x1="83" y1="5" x2="92" y2="5" />
          <line x1="88" y1="8" x2="92" y2="8" />
        </g>
        {/* top-right arrow >>> */}
        <g stroke={glow} strokeWidth="1.2" fill="none" strokeLinecap="square">
          <polyline points="68,4 71,7 68,10" />
          <polyline points="72,4 75,7 72,10" />
          <polyline points="76,4 79,7 76,10" />
        </g>
        {/* bottom-left dot row (status pips) */}
        <g fill={glow}>
          <rect x="2" y="92" width="2" height="2" />
          <rect x="6" y="92" width="2" height="2" />
          <rect x="10" y="92" width="2" height="2" opacity="0.5" />
          <rect x="14" y="92" width="2" height="2" opacity="0.3" />
        </g>
        {/* bottom-right small bracket */}
        <g stroke={accent} strokeWidth="0.5" fill="none">
          <polyline points="92,88 96,88 96,96" />
        </g>
        {/* top-left small bracket */}
        <g stroke={accent} strokeWidth="0.5" fill="none">
          <polyline points="4,8 4,4 8,4" />
        </g>
      </svg>

      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}
