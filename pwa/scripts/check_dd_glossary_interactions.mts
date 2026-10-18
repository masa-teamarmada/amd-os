import assert from "node:assert/strict";
import { installDdGlossaryInteractions } from "../src/lib/dd-glossary-interactions.ts";

class NodeFixture {
  parent: NodeFixture | null = null;
  children: NodeFixture[] = [];
  contains(node: unknown): boolean { return this === node || this.children.some(child => child.contains(node)); }
}
class ElementFixture extends NodeFixture {
  attrs = new Map<string, string>();
  open = false;
  term = false;
  style: Record<string, any> = { removeProperty: (name: string) => { delete this.style[name]; } };
  handlers = new Map<string, Function>();
  closest(): ElementFixture | null { return this.term ? this : this.parent instanceof ElementFixture ? this.parent.closest() : null; }
  getAttribute(name: string) { return this.attrs.get(name) ?? null; }
  setAttribute(name: string, value: string) { this.attrs.set(name, value); }
  removeAttribute(name: string) { this.attrs.delete(name); }
  matches() { return this.open; }
  showPopover() { this.open = true; }
  hidePopover() { this.open = false; }
  getBoundingClientRect() { return this.term ? { left: 220, top: 560, bottom: 580 } : { width: 280, height: 160 }; }
  addEventListener(name: string, callback: Function) { this.handlers.set(name, callback); }
  removeEventListener(name: string) { this.handlers.delete(name); }
}
const root = new ElementFixture(), button = new ElementFixture(), popup = new ElementFixture(), outside = new ElementFixture();
root.children = [button, popup]; button.parent = popup.parent = root; button.term = true; button.attrs.set("popovertarget", "term-fixture");
const timers = new Map<number, Function>(), windowHandlers = new Map<string, Function>();
let sequence = 0;
const win = {
  innerWidth: 320, innerHeight: 640,
  setTimeout: (fn: Function) => { timers.set(++sequence, fn); return sequence; },
  clearTimeout: (id: number) => timers.delete(id),
  addEventListener: (name: string, fn: Function) => windowHandlers.set(name, fn),
  removeEventListener: (name: string) => windowHandlers.delete(name),
};
const doc = { getElementById: (id: string) => id === "term-fixture" ? popup : null, activeElement: outside };
const globals = globalThis as any;
const prior = Object.fromEntries(["Node", "Element", "window", "document"].map(key => [key, globals[key]]));
Object.assign(globals, { Node: NodeFixture, Element: ElementFixture, window: win, document: doc });
const send = (name: string, target = button, values: Record<string, unknown> = {}) => {
  const event = { target, pointerType: "mouse", relatedTarget: null, prevented: false, preventDefault() { this.prevented = true; }, ...values };
  root.handlers.get(name)!(event); return event;
};
const flush = () => { for (const [key, fn] of timers) { timers.delete(key); fn(); } };
try {
  const dispose = installDdGlossaryInteractions(root as unknown as HTMLElement);
  send("pointerover");
  assert.ok(popup.open, "マウスオーバーだけで開く");
  assert.equal(popup.style.left, "28px", "狭い画面の右端に収める");
  assert.equal(popup.style.top, "392px", "下に入らない場合は用語の上へ出す");
  send("pointerout", button, { relatedTarget: popup }); flush(); assert.ok(popup.open, "説明へ移動しても閉じない");
  send("pointerout", popup, { relatedTarget: outside });
  send("pointerover", popup); flush(); assert.ok(popup.open, "猶予内に戻ったら読み続けられる");
  send("pointerout", popup, { relatedTarget: outside }); flush(); assert.equal(popup.open, false);
  send("pointerover", button, { pointerType: "touch" }); assert.equal(popup.open, false, "タッチの疑似ホバーでは開かない");
  assert.equal(send("click").prevented, false, "ネイティブのタップ動作を維持する");
  send("pointerover"); assert.equal(send("click").prevented, true, "ホバー後のクリックで開いたままにする");
  send("pointerout", button, { relatedTarget: outside }); flush(); assert.ok(popup.open);
  popup.open = false; send("toggle", popup);
  assert.equal(popup.getAttribute("data-amie-hover"), null, "Escapeや外側クリック後に位置指定を解除する");
  doc.activeElement = button; send("focusin"); assert.ok(popup.open, "キーボードフォーカスで説明を開く");
  doc.activeElement = outside; send("focusout", button, { relatedTarget: outside }); flush(); assert.equal(popup.open, false);
  send("pointerover"); dispose(); assert.equal(popup.open, false);
  assert.equal(root.handlers.size, 0); assert.equal(windowHandlers.size, 0); assert.equal(timers.size, 0);
} finally {
  for (const [key, value] of Object.entries(prior)) { if (value === undefined) delete globals[key]; else globals[key] = value; }
}
console.log("DD glossary: immediate hover, popup travel, delayed dismissal, touch/click/focus, viewport placement and cleanup PASS");
