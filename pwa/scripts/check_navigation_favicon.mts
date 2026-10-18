import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// 実コンポーネントを実行し、ファビコンの差替え・復元と遷移対象の判定を検証する。
const effects: Array<() => void | (() => void)> = [];
const events = new Map<string, Function>();
const intervals = new Map<number, Function>();
const timeouts = new Map<number, Function>();
let timerId = 0, frame = 0;
class FakeElement { closest() { return this; } }
class FakeAnchor extends FakeElement {
  attrs = new Map<string, string>();
  target = ""; download = false;
  href: string;
  constructor(href: string) { super(); this.href = href; }
  hasAttribute(name: string) { return name === "download" && this.download; }
  getAttribute(name: string) { return this.attrs.get(name) ?? null; }
  setAttribute(name: string, value: string) { this.attrs.set(name, value); }
  removeAttribute(name: string) { this.attrs.delete(name); }
}
class FakeIcon {
  attrs = new Map<string, string>([["href", "/favicon-amd.ico"], ["type", "image/x-icon"]]);
  getAttribute(key: string) { return this.attrs.get(key) ?? null; }
  setAttribute(key: string, value: string) { this.attrs.set(key, value); }
  removeAttribute(key: string) { this.attrs.delete(key); }
  set href(value: string) { this.setAttribute("href", value); }
  set type(value: string) { this.setAttribute("type", value); }
  set sizes(value: string) { this.setAttribute("sizes", value); }
}
const icons = [new FakeIcon(), new FakeIcon()];
icons[1].attrs = new Map([["href", "/icon.png"], ["type", "image/png"], ["sizes", "512x512"]]);
const originals = icons.map(icon => new Map(icon.attrs));
const dataset: Record<string, string> = {};
const dom: any = {
  documentElement: { dataset },
  createElement: () => ({ width: 0, height: 0, getContext: () => ({ clearRect() {}, beginPath() {}, arc() {}, stroke() {} }), toDataURL: () => `data:image/png;base64,frame${frame++}` }),
  querySelectorAll: () => icons,
  addEventListener: (name: string, callback: Function) => events.set(name, callback),
  removeEventListener: (name: string) => events.delete(name),
};
const win: any = {
  location: { origin: "https://os.test", pathname: "/dd/sol", search: "?tab=company" },
  setInterval: (callback: Function) => { intervals.set(++timerId, callback); return timerId; },
  clearInterval: (id: number) => intervals.delete(id),
  setTimeout: (callback: Function) => { timeouts.set(++timerId, callback); return timerId; },
  clearTimeout: (id: number) => timeouts.delete(id),
  addEventListener: (name: string, callback: Function) => events.set(name, callback),
  removeEventListener: (name: string) => events.delete(name),
};
const globals = globalThis as any;
const previous = Object.fromEntries(["window", "document", "Element", "HTMLAnchorElement"].map(key => [key, globals[key]]));
Object.assign(globals, { window: win, document: dom, Element: FakeElement, HTMLAnchorElement: FakeAnchor });
try {
  const source = readFileSync("src/components/nav/NavigationFavicon.tsx", "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const output: Record<string, Function> = {};
  new Function("require", "exports", compiled)((name: string) => name === "react" ? { useEffect: (fn: () => void) => effects.push(fn), useRef: (value: unknown) => ({ current: value }) } : { usePathname: () => win.location.pathname, useSearchParams: () => new URLSearchParams(win.location.search) }, output);
  output.NavigationFavicon();
  const dispose = effects[0](); effects[1]();
  const click = (href: string, options: Record<string, unknown> = {}, linkOptions: Record<string, unknown> = {}) => {
    const event = { button: 0, target: Object.assign(new FakeAnchor(href), linkOptions), prevented: false, stopped: false,
      preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...options };
    events.get("click")!(event);
    return event;
  };
  for (const test of [
    ["https://other.test/dd/sol", {}, {}],
    ["https://os.test/dd/sol?tab=company#section", {}, {}],
    ["https://os.test/dd/sol?tab=team", { ctrlKey: true }, {}],
    ["https://os.test/dd/sol?tab=team", { button: 1 }, {}],
    ["https://os.test/dd/sol?tab=team", {}, { target: "_blank" }],
    ["https://os.test/dd/sol?tab=team", {}, { download: true }],
  ] as const) { click(test[0], test[1], test[2]); assert.equal(intervals.size, 0, "new tabs, downloads, external sites and in-page links are ignored"); }
  click("https://os.test/dd/sol?tab=team");
  assert.equal(dataset.amieNavigationPending, "true");
  assert.match(icons[0].getAttribute("href")!, /^data:image\/png/);
  const first = icons[0].getAttribute("href"); [...intervals.values()][0]();
  assert.notEqual(icons[0].getAttribute("href"), first, "frame changes while navigation is pending");
  effects[1]();
  assert.equal(intervals.size, 0);
  icons.forEach((icon, index) => assert.deepEqual(icon.attrs, originals[index], "original favicon attributes restored after route commit"));
  const chapterClick = click("https://os.test/dd/sol?chapter=financial-plan");
  assert.equal(dataset.amieNavigationPending, "true", "新版の章移動でも画面内の回転表示を開始する");
  assert.equal(chapterClick.target.getAttribute("data-amie-navigation-target"), "true", "押したリンクを即時に強調する");
  assert.equal(chapterClick.target.getAttribute("aria-busy"), "true");
  const repeated = click("https://os.test/dd/sol?chapter=financial-plan");
  assert.ok(repeated.prevented && repeated.stopped, "同じ移動先の連打は新しい遷移を起動しない");
  assert.equal(chapterClick.target.getAttribute("data-amie-navigation-target"), "true");
  const otherChapter = click("https://os.test/dd/sol?chapter=organization");
  assert.equal(otherChapter.prevented, false, "別の移動先への変更は許す");
  assert.equal(chapterClick.target.getAttribute("aria-busy"), null, "前のリンクの状態を戻す");
  effects[1]();
  assert.equal(dataset.amieNavigationPending, undefined, "本文の切替後に画面内の回転表示も終える");
  assert.equal(otherChapter.target.getAttribute("data-amie-navigation-target"), null);
  assert.equal(otherChapter.target.getAttribute("aria-busy"), null);
  assert.equal(click("https://os.test/dd/sol?chapter=organization").prevented, false, "完了後は再選択できる");
  effects[1]();
  events.get("popstate")!(); assert.equal(intervals.size, 1, "back/forward also animate");
  [...timeouts.values()][0](); assert.equal(intervals.size, 0, "cancelled/failed navigation cannot leave a permanent spinner");
  events.get("beforeunload")!();
  assert.equal(dataset.amieNavigationPending, "true", "リロード開始時にも回転・読み込み中を表示する");
  events.get("pageshow")!(); assert.equal(intervals.size, 0, "再表示時に状態を戻す");
  click("https://os.test/dd/sol?tab=team"); events.get("pagehide")!();
  assert.equal(intervals.size, 0);
  if (typeof dispose === "function") dispose();
  assert.equal(events.size, 0);
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete globals[key]; else globals[key] = value;
  }
}
console.log("Navigation favicon: real animation frames, route completion, history, cancellation cleanup, ignored links and original attributes PASS");
