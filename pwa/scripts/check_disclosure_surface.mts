import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { appDisclosureScope, handleDisclosureSurfaceClick } from "../src/lib/disclosure-surface.ts";

// Real DOM selectors/ancestry; browser geometry and native summary activation are
// verified separately in PC Chrome. No application data or write action is used.
const { document, window } = parseHTML(`<html><body><main data-amie-disclosure-scope="app">
  <section id="card" data-amie-disclosure-surface><span id="gap">Record</span>
    <button id="trigger" data-amie-disclosure-trigger><svg><path id="icon" /></svg>Details</button>
    <a id="link" href="/document">Document</a><button id="undo">Undo</button>
    <label id="label"><input id="input" /></label><select id="select"></select>
    <div id="editable" contenteditable="true">Edit</div>
    <div id="body" data-amie-disclosure-content><span id="body-text">Full text</span>
      <section id="nested" data-amie-disclosure-surface><span id="nested-gap">Nested</span><button id="nested-trigger" data-amie-disclosure-trigger>Nested details</button></section>
      <details id="nested-native"><summary id="nested-summary">Sources</summary><p id="nested-body">Source text</p></details>
    </div>
  </section>
  <details id="native"><summary id="summary">Notes</summary><div id="native-body">Notes text</div>
    <div data-amie-disclosure-surface><span id="native-custom-gap">Inner card</span><button id="native-custom-trigger" data-amie-disclosure-trigger>Inner details</button></div>
  </details>
  <section data-amie-disclosure-surface><span id="missing">No trigger</span></section>
</main></body></html>`);
Object.assign(globalThis, { Element: window.Element });
const get = (id: string) => document.getElementById(id)! as unknown as HTMLElement;
const root = document.querySelector("main")! as unknown as HTMLElement;
let selected: Selection | null = null;
Object.defineProperty(window, "getSelection", { value: () => selected, configurable: true });
let mainCalls = 0;
let nestedCalls = 0;
let nativeCalls = 0;
let nestedNativeCalls = 0;
let nativeCustomCalls = 0;
get("trigger").addEventListener("click", () => { mainCalls += 1; });
get("nested-trigger").addEventListener("click", () => { nestedCalls += 1; });
get("summary").addEventListener("click", () => { nativeCalls += 1; });
get("nested-summary").addEventListener("click", () => { nestedNativeCalls += 1; });
get("native-custom-trigger").addEventListener("click", () => { nativeCustomCalls += 1; });
function rect(element: HTMLElement, top: number, height: number) {
  element.getBoundingClientRect = () => ({ top, bottom: top + height, left: 0, right: 400, width: 400, height, x: 0, y: top, toJSON: () => ({}) });
}
rect(get("body"), 100, 160);
rect(get("summary"), 20, 30);
rect(get("nested-summary"), 110, 30);
function fire(id: string, y = 30, defaultPrevented = false) {
  let prevented = false;
  let stopped = false;
  handleDisclosureSurfaceClick({ target: get(id), currentTarget: root, clientY: y, defaultPrevented,
    preventDefault: () => { prevented = true; }, stopPropagation: () => { stopped = true; } });
  return { prevented, stopped };
}
assert.deepEqual(fire("gap"), { prevented: true, stopped: true });
assert.equal(mainCalls, 1, "blank header space activates the existing trigger exactly once");
for (const id of ["trigger", "icon", "link", "undo", "label", "input", "select", "editable"]) {
  assert.deepEqual(fire(id), { prevented: false, stopped: false }, `${id} must keep its own action`);
}
assert.equal(mainCalls, 1, "links, form fields, labels, nested buttons and SVG icons cannot double toggle");
get("trigger").click();
assert.equal(mainCalls, 2, "the original native button remains the keyboard activation path");
fire("body-text", 130);
fire("card", 270);
assert.equal(mainCalls, 2, "expanded body and padding below the body cannot close the card");
fire("nested-gap", 115);
assert.equal(nestedCalls, 1, "the innermost header owns its toggle");
assert.equal(mainCalls, 2);
fire("nested-native", 120);
assert.equal(nestedNativeCalls, 1, "native disclosures also work inside a custom card body");
fire("nested-body", 170);
assert.equal(mainCalls, 2);
selected = { isCollapsed: false, anchorNode: get("gap").firstChild, focusNode: get("gap").firstChild } as unknown as Selection;
fire("gap");
assert.equal(mainCalls, 2, "dragging to select header text must not expand it");
selected = null;
const trigger = get("trigger") as HTMLButtonElement;
trigger.disabled = true;
fire("gap");
assert.equal(mainCalls, 2, "a disabled disclosure cannot be activated through its padding");
trigger.disabled = false;
trigger.setAttribute("aria-disabled", "true");
fire("gap");
assert.equal(mainCalls, 2);
trigger.removeAttribute("aria-disabled");
fire("gap", 30, true);
assert.equal(mainCalls, 2, "respect earlier event cancellation");
fire("missing");

const native = get("native") as HTMLDetailsElement;
native.open = false;
fire("native", 75);
assert.equal(nativeCalls, 1, "all padding of a collapsed native card activates its summary");
native.open = true;
fire("native", 15);
assert.equal(nativeCalls, 2, "top and side padding of an open header are also active");
fire("native", 150);
fire("native-body", 70);
assert.equal(nativeCalls, 2, "expanded native body/padding cannot close the card");
fire("native-custom-gap", 100);
assert.equal(nativeCustomCalls, 1, "custom disclosures work inside open native details");
fire("summary");
assert.equal(nativeCalls, 2, "native summary activation is not intercepted or duplicated");
rect(get("summary"), 20, 0);
fire("native", 20);
assert.equal(nativeCalls, 2, "invisible native headers must not be activated");
root.removeAttribute("data-amie-disclosure-scope");
fire("gap");
assert.equal(mainCalls, 2, "DD/print/embedded views without the application scope are untouched");
for (const path of ["/dashboard", "/notifications", "/admin/change-history", "/project/p00/cockpit", "/project/p07/workspace"]) assert.equal(appDisclosureScope(path), true);
for (const path of ["/dd/sol", "/project/p07/dd", "/project/p07/dd/preview/budget", "/native", "/native/cockpit", "/project/p07/report/202611/print"]) assert.equal(appDisclosureScope(path), false);
console.log("Disclosure surfaces: header whitespace, controls, nesting, selection, disabled state, native padding, body safety and DD/print scope passed.");
