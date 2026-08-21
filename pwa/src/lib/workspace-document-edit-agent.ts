/**
 * 編集フレームの中で走るエージェント。
 *
 * このフレームは `sandbox allow-scripts` だけを持ち、`allow-same-origin` を持たない。
 * つまり不透明オリジンなので、資料HTMLはまさのセッションのcookieにもlocalStorageにも
 * 親のDOMにも到達できない。親とのやり取りはpostMessageだけで、origin は "null" になる。
 * origin で送信元を確かめられないから、リクエストごとに発行したtokenを毎回照合する。
 *
 * 実装の制約:
 * - この関数は `toString()` して `<script nonce>` へ埋め込むので、**外の識別子を参照できない**。
 *   クロージャはtoStringに含まれない。ヘルパーを呼びたくなったら関数の中へ書く。
 * - transpileのヘルパー (`__assign` 等) が注入されると、埋め込んだ側で未定義参照になって
 *   フレームが黙って死ぬ。だからspread・async/await・for...of・optional chainingを使わない。
 */

/** 編集フレームへ渡す設定。 */
export type WorkspaceDocumentEditAgentConfig = {
  /** 親と共有する照合token。postMessageのなりすましを弾く唯一の手段。 */
  token: string;
};

/** 親が選択要素について知る内容。書式パネルの表示はこれだけで決まる。 */
export type WorkspaceDocumentEditSelection = {
  tag: string;
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
  fontSize: number;
  align: string;
  hasParent: boolean;
  slideIndex: number;
};

/** 区切り候補。親はこれを並べて「スライドの区切りはこれで合ってる?」と聞く。 */
export type WorkspaceDocumentSlideCandidate = {
  selector: string;
  count: number;
  sameParent: boolean;
  labels: string[];
};

/** 確定した区切りで数えたスライド。 */
export type WorkspaceDocumentSlideSummary = {
  index: number;
  label: string;
};

function agent(config: WorkspaceDocumentEditAgentConfig) {
  var TOKEN = config.token;
  var SELECTED_ATTR = "data-amd-selected";
  var SLIDE_ATTR = "data-amd-slide";
  var STYLE_ID = "amd-edit-agent-style";
  var slideSelector = "";
  var selected: HTMLElement | null = null;

  function post(payload: Record<string, unknown>) {
    payload.amd = TOKEN;
    parent.postMessage(payload, "*");
  }

  function textOf(node: Element, limit: number) {
    var raw = node.textContent || "";
    var text = raw.replace(/\s+/g, " ").trim();
    return text.length > limit ? text.slice(0, limit) + "…" : text;
  }

  /** rgb(...) を #rrggbb へ。色の入力欄はhexしか受け取らない。 */
  function toHex(value: string) {
    var match = /rgba?\(([^)]+)\)/.exec(value || "");
    if (!match) return "#000000";
    var parts = match[1].split(",");
    var out = "#";
    for (var i = 0; i < 3; i += 1) {
      var n = Math.max(0, Math.min(255, Math.round(parseFloat(parts[i]) || 0)));
      out += (n < 16 ? "0" : "") + n.toString(16);
    }
    return out;
  }

  function slides(): HTMLElement[] {
    if (!slideSelector) return [];
    var found: HTMLElement[] = [];
    var nodes = document.querySelectorAll(slideSelector);
    for (var i = 0; i < nodes.length; i += 1) found.push(nodes[i] as HTMLElement);
    return found;
  }

  function slideIndexOf(node: Element | null) {
    if (!node) return -1;
    var list = slides();
    for (var i = 0; i < list.length; i += 1) {
      if (list[i] === node || list[i].contains(node)) return i;
    }
    return -1;
  }

  /** 番号を振り直して親へ送る。並べ替え・複製・削除のあと必ず呼ぶ。 */
  function publishSlides() {
    var list = slides();
    var summary: WorkspaceDocumentSlideSummary[] = [];
    var previous = document.querySelectorAll("[" + SLIDE_ATTR + "]");
    for (var p = 0; p < previous.length; p += 1) previous[p].removeAttribute(SLIDE_ATTR);
    for (var i = 0; i < list.length; i += 1) {
      list[i].setAttribute(SLIDE_ATTR, String(i));
      var heading = list[i].querySelector("h1, h2, h3, h4, [class*='title']");
      var label = heading ? textOf(heading, 40) : textOf(list[i], 40);
      summary.push({ index: i, label: label || "(文字の無いスライド)" });
    }
    post({ type: "slides", selector: slideSelector, slides: summary });
  }

  /**
   * 区切り候補を並べる。
   *
   * 資料ごとに構造が違うので自動で決め打ちしない。候補と件数と見出しを見せて、
   * まさが「これで合ってる」と決めた結果を覚える。
   */
  function candidates() {
    var probes = [
      "section",
      "article",
      ".slide",
      ".page",
      "[class*='slide']",
      "[class*='page']",
      "body > div",
      "body > section",
      "main > div",
      "main > section",
    ];
    var out: WorkspaceDocumentSlideCandidate[] = [];
    var seen: Record<string, boolean> = {};
    for (var i = 0; i < probes.length; i += 1) {
      var nodes: NodeListOf<Element>;
      try {
        nodes = document.querySelectorAll(probes[i]);
      } catch (_e) {
        continue;
      }
      if (nodes.length < 2) continue;
      var key = "";
      var labels: string[] = [];
      var sameParent = true;
      var firstParent = nodes[0].parentElement;
      for (var j = 0; j < nodes.length; j += 1) {
        key += "|" + (nodes[j] as HTMLElement).tagName + (nodes[j] as HTMLElement).className;
        if (nodes[j].parentElement !== firstParent) sameParent = false;
        if (labels.length < 3) labels.push(textOf(nodes[j], 24));
      }
      // 同じ集合を指す別表現を2回出さない。選ぶ側が混乱する。
      if (seen[key]) continue;
      seen[key] = true;
      out.push({ selector: probes[i], count: nodes.length, sameParent: sameParent, labels: labels });
    }
    return out;
  }

  function describe(node: HTMLElement | null): WorkspaceDocumentEditSelection | null {
    if (!node) return null;
    var style = getComputedStyle(node);
    var weight = parseInt(style.fontWeight, 10);
    return {
      tag: node.tagName.toLowerCase(),
      text: textOf(node, 60),
      bold: weight >= 600 || style.fontWeight === "bold",
      italic: style.fontStyle === "italic",
      underline: style.textDecorationLine.indexOf("underline") >= 0,
      color: toHex(style.color),
      fontSize: Math.round(parseFloat(style.fontSize) || 16),
      align: style.textAlign || "start",
      hasParent: !!node.parentElement && node.parentElement !== document.documentElement,
      slideIndex: slideIndexOf(node),
    };
  }

  function publishSelection() {
    post({ type: "selection", selection: describe(selected) });
  }

  function select(node: HTMLElement | null) {
    if (selected && selected !== node) {
      selected.removeAttribute(SELECTED_ATTR);
      if (selected.isContentEditable) selected.removeAttribute("contenteditable");
    }
    selected = node;
    if (selected) selected.setAttribute(SELECTED_ATTR, "1");
    publishSelection();
  }

  function markDirty() {
    post({ type: "dirty" });
  }

  /**
   * 文字を打っている最中の後始末。
   *
   * dirty だけ送ると、右のパネルに出ている要素の文言や大きさが打つ前のまま固まる。
   * かといって打鍵ごとに選択情報を送ると、変換中の1文字ごとに親との往復が増える。
   * 手が止まってから1回だけ送り直す。
   */
  var typingTimer = 0;
  function markTyping() {
    markDirty();
    if (typingTimer) window.clearTimeout(typingTimer);
    typingTimer = window.setTimeout(function () {
      typingTimer = 0;
      publishSelection();
    }, 150);
  }

  /**
   * 書式を当てる。
   *
   * 文字の一部を選んでいるならその範囲だけ、選んでいないなら要素まるごと。
   * execCommand は非推奨だが、contenteditable の部分選択へ書式を当てる代替が実際には無い。
   */
  function applyFormat(command: string, value: string) {
    if (!selected) return;
    var selection = window.getSelection();
    var partial =
      !!selection &&
      selection.rangeCount > 0 &&
      !selection.isCollapsed &&
      selected.contains(selection.anchorNode);
    if (partial) {
      if (command === "bold") document.execCommand("bold");
      else if (command === "italic") document.execCommand("italic");
      else if (command === "underline") document.execCommand("underline");
      else if (command === "color") document.execCommand("foreColor", false, value);
      else if (command === "fontSize") {
        document.execCommand("fontSize", false, "7");
        var fonts = selected.querySelectorAll("font[size='7']");
        for (var i = 0; i < fonts.length; i += 1) {
          var el = fonts[i] as HTMLElement;
          el.removeAttribute("size");
          el.style.fontSize = value + "px";
        }
      } else if (command === "align") (selected as HTMLElement).style.textAlign = value;
      markDirty();
      publishSelection();
      return;
    }
    var target = selected;
    if (command === "bold") {
      var weight = parseInt(getComputedStyle(target).fontWeight, 10);
      target.style.fontWeight = weight >= 600 ? "400" : "700";
    } else if (command === "italic") {
      target.style.fontStyle = getComputedStyle(target).fontStyle === "italic" ? "normal" : "italic";
    } else if (command === "underline") {
      var line = getComputedStyle(target).textDecorationLine;
      target.style.textDecoration = line.indexOf("underline") >= 0 ? "none" : "underline";
    } else if (command === "color") target.style.color = value;
    else if (command === "fontSize") target.style.fontSize = value + "px";
    else if (command === "align") target.style.textAlign = value;
    markDirty();
    publishSelection();
  }

  function slideAction(action: string, index: number) {
    var list = slides();
    var node = list[index];
    if (!node || !node.parentElement) return;
    if (action === "delete") {
      if (list.length <= 1) return;
      node.parentElement.removeChild(node);
    } else if (action === "duplicate") {
      var copy = node.cloneNode(true) as HTMLElement;
      copy.removeAttribute(SELECTED_ATTR);
      node.parentElement.insertBefore(copy, node.nextSibling);
    } else if (action === "up") {
      var before = list[index - 1];
      if (!before) return;
      node.parentElement.insertBefore(node, before);
    } else if (action === "down") {
      var after = list[index + 1];
      if (!after) return;
      node.parentElement.insertBefore(after, node);
    }
    select(null);
    markDirty();
    publishSlides();
  }

  /**
   * 保存用のHTMLを作る。
   *
   * 編集中のDOMをそのまま出すと、選択の印もcontenteditableも注入したstyleも資料へ焼き付く。
   * cloneしてから掃除するので、掃除しても画面の編集状態は壊れない。
   */
  function serialize() {
    var clone = document.documentElement.cloneNode(true) as HTMLElement;
    var style = clone.querySelector("#" + STYLE_ID);
    if (style && style.parentElement) style.parentElement.removeChild(style);
    var scripts = clone.querySelectorAll("script[data-amd-agent]");
    for (var s = 0; s < scripts.length; s += 1) {
      if (scripts[s].parentElement) scripts[s].parentElement!.removeChild(scripts[s]);
    }
    var marks = clone.querySelectorAll("[" + SELECTED_ATTR + "], [" + SLIDE_ATTR + "], [contenteditable]");
    for (var m = 0; m < marks.length; m += 1) {
      marks[m].removeAttribute(SELECTED_ATTR);
      marks[m].removeAttribute(SLIDE_ATTR);
      marks[m].removeAttribute("contenteditable");
    }
    return clone.outerHTML;
  }

  var css =
    "[" + SELECTED_ATTR + "]{outline:2px solid #0066cc !important;outline-offset:2px !important;}" +
    "[" + SELECTED_ATTR + "][contenteditable='true']{outline:2px dashed #f59e0b !important;}" +
    "body{cursor:default !important;}";
  var styleTag = document.createElement("style");
  styleTag.id = STYLE_ID;
  styleTag.textContent = css;
  document.head.appendChild(styleTag);

  document.addEventListener(
    "click",
    function (event) {
      var target = event.target as HTMLElement | null;
      if (!target || target === document.documentElement) return;
      // 編集中の要素の中のクリックは、選択の切り替えではなくキャレット移動。
      if (selected && selected.isContentEditable && selected.contains(target)) return;
      event.preventDefault();
      event.stopPropagation();
      select(target);
    },
    true,
  );

  document.addEventListener(
    "dblclick",
    function (event) {
      var target = event.target as HTMLElement | null;
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      select(target);
      target.setAttribute("contenteditable", "true");
      target.focus();
      publishSelection();
    },
    true,
  );

  document.addEventListener("input", markTyping, true);

  // 資料のリンクでフレームごと別ページへ飛ばれると、編集内容が消える。
  document.addEventListener(
    "submit",
    function (event) {
      event.preventDefault();
    },
    true,
  );

  window.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || typeof data !== "object") return;
    if (data.amd !== TOKEN) return;
    var type = data.type;
    if (type === "command") applyFormat(String(data.command), String(data.value == null ? "" : data.value));
    else if (type === "selectParent") {
      if (selected && selected.parentElement && selected.parentElement !== document.documentElement) {
        select(selected.parentElement);
      }
    } else if (type === "clearSelection") select(null);
    else if (type === "setSlideSelector") {
      slideSelector = String(data.selector || "");
      publishSlides();
    } else if (type === "slideAction") slideAction(String(data.action), Number(data.index));
    else if (type === "focusSlide") {
      var list = slides();
      var node = list[Number(data.index)];
      if (node) node.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (type === "serialize") {
      post({ type: "serialized", requestId: data.requestId, html: serialize() });
    }
  });

  post({ type: "ready", candidates: candidates() });
}

/**
 * `<script nonce>` へ埋め込む本文を作る。
 *
 * `toString()` を使うので、agent が外の識別子を参照した瞬間にフレームが黙って壊れる。
 * その退化を止めるため、契約テストで「参照が閉じているか」を検査する。
 */
export function workspaceDocumentEditAgentSource(config: WorkspaceDocumentEditAgentConfig): string {
  return "(" + agent.toString() + ")(" + JSON.stringify(config) + ");";
}
