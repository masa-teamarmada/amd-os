"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";

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

interface JapanTopology extends Topology {
  objects: {
    japan: GeometryCollection<PrefGeoProps>;
  };
}

type PrefectureFeature = Feature<Geometry, PrefGeoProps>;

export default function JapanMap({
  activePrefectures,
  selectedPrefecture,
  onSelectPrefecture,
}: JapanMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [hovered, setHovered] = useState<string | null>(null);
  const [prefectures, setPrefectures] = useState<PrefectureFeature[]>([]);
  const [loadError, setLoadError] = useState(false);

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

  useEffect(() => {
    const controller = new AbortController();

    fetch(TOPO_URL, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("japan_topology_load_failed");
        return response.json() as Promise<JapanTopology>;
      })
      .then((topology) => {
        const converted = feature(topology, topology.objects.japan);
        const nextFeatures =
          converted.type === "FeatureCollection"
            ? (converted.features as PrefectureFeature[])
            : [converted as unknown as PrefectureFeature];
        setPrefectures(nextFeatures);
        setLoadError(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(true);
      });

    return () => controller.abort();
  }, []);

  const mapPaths = useMemo(() => {
    if (prefectures.length === 0 || size.w <= 0 || size.h <= 0) return [];

    const collection: FeatureCollection<Geometry, PrefGeoProps> = {
      type: "FeatureCollection",
      features: prefectures,
    };
    const projection = geoMercator().fitExtent(
      [
        [16, 16],
        [Math.max(17, size.w - 16), Math.max(17, size.h - 16)],
      ],
      collection,
    );
    const createPath = geoPath(projection);

    return prefectures.map((prefecture, index) => ({
      key: String(prefecture.id ?? index),
      name: prefecture.properties?.nam_ja || prefecture.properties?.nam || "",
      path: createPath(prefecture) ?? "",
    }));
  }, [prefectures, size.h, size.w]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <svg
        viewBox={`0 0 ${size.w} ${size.h}`}
        className="h-full w-full"
        role="img"
        aria-label="日本文化コンテンツの都道府県地図"
        preserveAspectRatio="xMidYMid meet"
      >
        {mapPaths.map(({ key, name, path }) => {
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
            <path
              key={key}
              d={path}
              fill={fill}
              stroke="#0f172a"
              strokeWidth={0.4}
              className="transition-colors duration-150 focus:outline-none focus-visible:stroke-sky-300 focus-visible:stroke-[2]"
              style={{ cursor: hasContent ? "pointer" : "default" }}
              onMouseEnter={() => setHovered(name)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(name)}
              onBlur={() => setHovered(null)}
              onClick={() => onSelectPrefecture(name)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                onSelectPrefecture(name);
              }}
              tabIndex={0}
              role="button"
              aria-label={`${name}${hasContent ? "、コンテンツあり" : "、コンテンツなし"}`}
            >
              <title>{name}</title>
            </path>
          );
        })}
      </svg>

      {loadError && (
        <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground" role="alert">
          地図を読み込めませんでした
        </div>
      )}

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
