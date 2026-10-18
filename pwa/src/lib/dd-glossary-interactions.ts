/** DD本文の用語説明。PDF用の共通本文にはイベントを持たせない。 */
export function installDdGlossaryInteractions(root: HTMLElement) {
  let trigger: HTMLElement | null = null;
  let popup: HTMLElement | null = null;
  let pinned = false;
  let timer: number | undefined;
  const cancelClose = () => window.clearTimeout(timer);
  const inside = (node: EventTarget | null) => node instanceof Node && Boolean(trigger?.contains(node) || popup?.contains(node));
  const clear = () => {
    cancelClose();
    popup?.removeAttribute("data-amie-hover");
    for (const property of ["inset", "left", "top", "margin"]) popup?.style.removeProperty(property);
    trigger = null; popup = null; pinned = false;
  };
  const close = () => {
    const current = popup;
    clear();
    if (current?.matches(":popover-open")) current.hidePopover();
  };
  const position = () => {
    if (!trigger || !popup) return;
    const anchor = trigger.getBoundingClientRect();
    const box = popup.getBoundingClientRect();
    const below = anchor.bottom + 8;
    popup.style.left = `${Math.max(12, Math.min(anchor.left, window.innerWidth - box.width - 12))}px`;
    popup.style.top = `${Math.max(12, Math.min(below + box.height <= window.innerHeight - 12 ? below : anchor.top - box.height - 8, window.innerHeight - box.height - 12))}px`;
  };
  const show = (button: HTMLElement) => {
    const id = button.getAttribute("popovertarget");
    const next = id ? document.getElementById(id) : null;
    if (!next || !root.contains(next)) return;
    cancelClose();
    if (popup === next && next.matches(":popover-open")) return;
    close();
    trigger = button; popup = next;
    next.setAttribute("data-amie-hover", "true");
    next.style.inset = "auto"; next.style.margin = "0";
    next.showPopover();
    position();
  };
  const termButton = (target: EventTarget | null) => target instanceof Element ? target.closest<HTMLElement>("button.ddr-term, button.ddr-term-info") : null;
  const scheduleClose = () => {
    cancelClose();
    timer = window.setTimeout(() => { if (!pinned && !inside(document.activeElement)) close(); }, 200);
  };
  const pointerOver = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    const button = termButton(event.target);
    if (button) show(button);
    else if (inside(event.target)) cancelClose();
  };
  const pointerOut = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && inside(event.target) && !inside(event.relatedTarget)) scheduleClose();
  };
  const focusIn = (event: FocusEvent) => {
    const button = termButton(event.target);
    if (button) show(button);
    else if (inside(event.target)) cancelClose();
  };
  const focusOut = (event: FocusEvent) => { if (inside(event.target) && !inside(event.relatedTarget)) scheduleClose(); };
  const click = (event: MouseEvent) => {
    // マウスオーバーで開いた直後のクリックは、そのまま開いて固定する。
    if (termButton(event.target) === trigger && popup?.matches(":popover-open")) {
      event.preventDefault(); pinned = true; cancelClose();
    }
  };
  const toggle = (event: Event) => { if (popup && event.target === popup && !popup.matches(":popover-open")) clear(); };
  root.addEventListener("pointerover", pointerOver);
  root.addEventListener("pointerout", pointerOut);
  root.addEventListener("focusin", focusIn);
  root.addEventListener("focusout", focusOut);
  root.addEventListener("click", click);
  root.addEventListener("toggle", toggle, true);
  window.addEventListener("resize", position);
  window.addEventListener("scroll", position, true);
  return () => {
    close();
    root.removeEventListener("pointerover", pointerOver);
    root.removeEventListener("pointerout", pointerOut);
    root.removeEventListener("focusin", focusIn);
    root.removeEventListener("focusout", focusOut);
    root.removeEventListener("click", click);
    root.removeEventListener("toggle", toggle, true);
    window.removeEventListener("resize", position);
    window.removeEventListener("scroll", position, true);
  };
}
