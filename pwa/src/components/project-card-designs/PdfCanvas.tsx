"use client";

import { useEffect, useRef, useState } from "react";

/** Renders the stored PDF itself; no contact information is extracted or persisted. */
export function PdfCanvas({
  pdfUrl,
  title,
  compact = false,
}: {
  pdfUrl: string;
  title: string;
  compact?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("PDFを読み込み中…");
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    const controller = new AbortController();
    const node = host.current;
    node?.replaceChildren();
    setStatus("PDFを読み込み中…");
    setError(false);
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        if (cancelled) return;
        pdfjs.GlobalWorkerOptions.workerSrc =
          "/vendor/pdfjs/pdf.worker.min.mjs";
        const response = await fetch(pdfUrl, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("PDFを読み込めませんでした");
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (cancelled) return;
        const task = pdfjs.getDocument({
          data: bytes,
          disableFontFace: true,
          useWasm: false,
          cMapUrl: "/vendor/pdfjs/cmaps/",
          standardFontDataUrl: "/vendor/pdfjs/standard_fonts/",
        });
        cleanup = () => {
          void task.destroy();
        };
        const pdf = await task.promise;
        for (let i = 1; i <= pdf.numPages; i += 1) {
          if (cancelled || !node) return;
          const page = await pdf.getPage(i);
          const original = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({
            scale: Math.min(4, 1440 / original.width),
          });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          canvas.style.width = "100%";
          canvas.style.height = "auto";
          canvas.style.display = "block";
          canvas.setAttribute("role", "img");
          canvas.setAttribute("aria-label", `${title} ${i}ページ目`);
          const canvasContext = canvas.getContext("2d");
          if (!canvasContext) throw new Error("PDFを表示できませんでした");
          await page.render({ canvas, canvasContext, viewport }).promise;
          if (!cancelled) node.append(canvas);
        }
        if (!cancelled) setStatus(`${pdf.numPages}ページ`);
      } catch {
        if (!cancelled) {
          setError(true);
          setStatus(
            "PDFの表示に失敗しました。原本PDFをダウンロードして確認できます。",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
      cleanup?.();
      node?.replaceChildren();
    };
  }, [pdfUrl, title]);
  return (
    <div>
      <div
        aria-label={title}
        ref={host}
        style={{
          display: "grid",
          gap: 12,
          background: "var(--muted)",
          padding: 12,
          ...(compact ? { maxHeight: 440, overflowY: "auto" as const } : {}),
        }}
      />
      <p
        role={error ? "alert" : "status"}
        style={{ fontSize: 12, marginTop: 8 }}
      >
        {status} ·{" "}
        <a href={pdfUrl} style={{ textDecoration: "underline" }}>
          原本PDFをダウンロード
        </a>
      </p>
    </div>
  );
}
