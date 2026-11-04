import type { MouseEvent as ReactMouseEvent } from "react";

const SURFACE = "[data-amie-disclosure-surface]";
const TRIGGER = "button[data-amie-disclosure-trigger]";
const CONTENT = "[data-amie-disclosure-content]";
const INTERACTIVE = "a, button, input, select, textarea, label, summary, [contenteditable=''], [contenteditable='true'], [role='button'], [role='link'], [role='checkbox'], [role='switch'], [role='combobox'], [data-amie-disclosure-ignore]";

export function appDisclosureScope(pathname: string): boolean {
  return !pathname.startsWith("/native") && !/(?:^|\/)dd(?:\/|$)/.test(pathname) && !/\/print(?:\/|$)/.test(pathname);
}

function hasSelectedText(element: Element): boolean {
  const selection = element.ownerDocument.defaultView?.getSelection?.();
  return !!selection && !selection.isCollapsed && (element.contains(selection.anchorNode) || element.contains(selection.focusNode));
}

type SurfaceClick = Pick<ReactMouseEvent<HTMLElement>, "target" | "currentTarget" | "clientY" | "defaultPrevented" | "preventDefault" | "stopPropagation">;

/** Extend an explicitly registered header's existing native control, never its body/actions. */
export function handleDisclosureSurfaceClick(event: SurfaceClick): void {
  if (event.defaultPrevented || event.currentTarget.dataset.amieDisclosureScope !== "app") return;
  const target = event.target;
  if (!(target instanceof Element) || target.closest(INTERACTIVE)) return;

  // Native summaries already support Enter/Space. Include the enclosing card's padding.
  const surface = target.closest<HTMLElement>(SURFACE);
  const details = target.closest("details");
  if (details && (!surface || surface.contains(details))) {
    if (target !== details || hasSelectedText(details)) return;
    const summary = details.querySelector<HTMLElement>(":scope > summary");
    if (!summary) return;
    const rect = summary.getBoundingClientRect();
    if (!rect.width || !rect.height || (details.open && event.clientY > rect.bottom)) return;
    event.preventDefault();
    event.stopPropagation();
    summary.click();
    return;
  }

  if (!surface || hasSelectedText(surface)) return;
  const content = target.closest(CONTENT);
  if (content?.closest(SURFACE) === surface) return;
  // Padding below an expanded body belongs to the body, not to the header.
  const body = Array.from(surface.querySelectorAll<HTMLElement>(CONTENT)).find((node) => node.closest(SURFACE) === surface);
  if (body && body.getBoundingClientRect().height && event.clientY >= body.getBoundingClientRect().top) return;
  const trigger = Array.from(surface.querySelectorAll<HTMLButtonElement>(TRIGGER)).find((button) => button.closest(SURFACE) === surface);
  if (!trigger || trigger.disabled || trigger.getAttribute("aria-disabled") === "true") return;
  event.preventDefault();
  event.stopPropagation();
  trigger.click();
}
