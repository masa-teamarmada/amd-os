"use client";

import { useEffect, useRef, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";

const TOPO_URL = "/geo/japan-prefectures.topojson";

interface JapanMapProps {
  /** コンテンツを持つ都道府県名 (nam_ja) の集合 */
  activePrefectures: Set<string>;
  selectedPrefecture: string | null;
  onSelectPrefecture: (prefecture: string) => void;
}

// dataofjapan/land topojson は properties.nam_ja に日本語県名を持つ
interface PrefGeoProps {
  nam_ja?: string;
  nam?: string;
}

export default function JapanMap({
  activePrefectures,
  selectedPrefecture,
  onSelectPrefecture,
}: JapanMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          // 日本列島が収まるよう中心を本州中部、スケールを調整
          center: [137, 38],
          scale: 1100,
        }}
        width={size.w}
        height={size.h}
        style={{ width: "100%", height: "100%" }}
      >
        <ZoomableGroup minZoom={1} maxZoom={8}>
          <Geographies geography={TOPO_URL}>
            {({ geographies }: { geographies: Array<{ rsmKey: string; properties: PrefGeoProps }> }) =>
              geographies.map((geo) => {
                const name = geo.properties.nam_ja || geo.properties.nam || "";
                const hasContent = activePrefectures.has(name);
                const isSelected = selectedPrefecture === name;
                const isHovered = hovered === name;

                const fill = isSelected
                  ? "#0ea5e9"
                  : hasContent
                    ? isHovered
                      ? "#38bdf8"
                      : "#0369a1"
                    : isHovered
                      ? "#334155"
                      : "#1e293b";

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onMouseEnter={() => setHovered(name)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => onSelectPrefecture(name)}
                    style={{
                      default: {
                        fill,
                        stroke: "#0f172a",
                        strokeWidth: 0.4,
                        outline: "none",
                        cursor: hasContent ? "pointer" : "default",
                        transition: "fill 0.15s",
                      },
                      hover: {
                        fill,
                        stroke: "#0f172a",
                        strokeWidth: 0.4,
                        outline: "none",
                        cursor: hasContent ? "pointer" : "default",
                      },
                      pressed: {
                        fill: "#0ea5e9",
                        stroke: "#0f172a",
                        strokeWidth: 0.4,
                        outline: "none",
                      },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* hover tooltip */}
      {hovered && (
        <div className="absolute bottom-3 right-3 bg-background/90 backdrop-blur-sm rounded-md border border-border px-2.5 py-1 text-xs font-medium shadow-sm pointer-events-none">
          {hovered}
          {activePrefectures.has(hovered) && (
            <span className="ml-1.5 text-[10px] text-sky-400">● コンテンツあり</span>
          )}
        </div>
      )}
    </div>
  );
}
