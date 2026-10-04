"use client";

import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { ChevronsLeft } from "lucide-react";
import { ReaderTocContent, type ReaderTocContentProps } from "./ReaderPanels";

export interface ReaderTocColumnProps extends Omit<ReaderTocContentProps, "variant"> {
  /** 列を閉じる（開閉の状態の保存は呼び出し側） */
  onCollapse: () => void;
  /** 列の中の押下。ポインタで押したボタンのフォーカスを外すために使う（直後の矢印キーで本文をめくれるように） */
  onClick?: (e: ReactMouseEvent<HTMLElement>) => void;
}

/** 目次の項目が見える範囲の余白（px）。この内側に入っていなければ寄せる */
const REVEAL_PAD = 44;

/**
 * 広い画面（1100px 以上）で、読書画面の左に常に出す目次の列。設計正本 §6.4。
 * 中身は横から出るパネルと同じ部品（ReaderTocContent）。色は .bzr-root のテーマの変数で描く。
 * 本文のめくり（押す・スワイプ・ホイール・キー）の対象は .bzr-stage だけで、この列は外にある。
 */
export function ReaderTocColumn({ onCollapse, onClick, activeHeadingId, ...content }: ReaderTocColumnProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const { book, tab, chapterIndex } = content;

  // いま読んでいる見出し（なければ、いまの章）が列の見える範囲から外れていたら、その位置へ寄せる。
  // scrollIntoView は祖先まで動かし得るため、列の本体の scrollTop だけを動かす
  useEffect(() => {
    const body = rootRef.current?.querySelector<HTMLElement>(".bzr-panel-body");
    if (!body) return;
    const target =
      body.querySelector<HTMLElement>(".bzr-toc-sub-item.is-active") ??
      body.querySelector<HTMLElement>(".bzr-toc-item.is-current");
    if (!target) return;
    const b = body.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    if (r.top >= b.top + REVEAL_PAD && r.bottom <= b.bottom - REVEAL_PAD) return;
    body.scrollTop += r.top - b.top - (b.height - r.height) / 2;
  }, [activeHeadingId, tab, chapterIndex]);

  return (
    <nav className="bzr-toc-col" data-bzr-toc-col="true" aria-label="章の一覧" ref={rootRef} onClick={onClick}>
      <div className="bzr-toc-col-head">
        <span className="bzr-toc-col-title" lang={book.lang}>
          {book.title}
        </span>
        <button
          type="button"
          className="bzr-icon-btn"
          aria-label="目次を閉じる"
          title="目次を閉じる"
          onClick={onCollapse}
        >
          <ChevronsLeft aria-hidden="true" />
        </button>
      </div>
      <ReaderTocContent {...content} activeHeadingId={activeHeadingId} variant="column" />
    </nav>
  );
}
