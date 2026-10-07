"use client";

import { useEffect, useId, useState, type RefObject } from "react";
import styles from "./CostProcessSummary.module.css";

/** One continuous route, including the turn between rows. Geometry follows the
 * actual layout so four-column and two-column flows share the same ordering. */
export function CostProcessConnectors({ canvas }: { canvas: RefObject<HTMLDivElement | null> }) {
  const marker = useId();
  const [drawing, setDrawing] = useState({ width: 1, height: 1, paths: [] as string[] });
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      const scenes = [...element.querySelectorAll<HTMLElement>("[data-process-scene]")].map((scene) => {
        const rect = scene.getBoundingClientRect();
        return { x: rect.left - bounds.left + rect.width / 2, y: rect.top - bounds.top + rect.height / 2, port: Math.min(72, rect.width * .32) };
      });
      const paths = scenes.slice(0, -1).map((from, i) => {
        const to = scenes[i + 1];
        if (Math.abs(to.y - from.y) < 1) {
          const direction = to.x > from.x ? 1 : -1;
          return `M${from.x + direction * from.port},${from.y}H${to.x - direction * to.port}`;
        }
        const direction = from.x > bounds.width / 2 ? 1 : -1;
        const edge = direction === 1 ? bounds.width - 4 : 4;
        const radius = 12;
        return `M${from.x + direction * from.port},${from.y}H${edge - direction * radius}Q${edge},${from.y} ${edge},${from.y + radius}V${to.y - radius}Q${edge},${to.y} ${edge - direction * radius},${to.y}H${to.x + direction * to.port}`;
      });
      const next = { width: bounds.width, height: bounds.height, paths };
      setDrawing((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.querySelectorAll("[data-step-number]").forEach((step) => observer.observe(step));
    return () => observer.disconnect();
  }, [canvas]);
  return <svg className={styles.connectors} viewBox={`0 0 ${drawing.width} ${drawing.height}`} preserveAspectRatio="none" aria-hidden="true" focusable="false" data-testid="cost-process-connectors">
    <defs><marker id={marker} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="m1 1 5 3-5 3" className={styles.connectorArrow} /></marker></defs>
    {drawing.paths.map((path, i) => <g key={i}><path d={path} className={styles.connectorTrack} /><path d={path} className={styles.connectorPath} markerEnd={`url(#${marker})`} /></g>)}
  </svg>;
}
