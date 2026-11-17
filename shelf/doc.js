/* Renders a canvas-style document tree: { t, p, c }. */

export function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else el.setAttribute(k, String(v));
    }
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

function newTab(href, attrs, ...kids) {
  const a = h("a", Object.assign({}, attrs, { href, target: "_blank", rel: "noopener noreferrer" }), ...kids);
  a.append(h("span", { class: "sr" }, " (opens in a new tab)"));
  return a;
}

let stepSeq = 0;
let captionSeq = 0;

function headingTag(level) {
  return "h" + Math.min(Math.max(level, 2), 6);
}

function nearestHeading(el) {
  let node = el;
  while (node && node !== document.body) {
    let prev = node.previousElementSibling;
    while (prev) {
      if (/^H[1-6]$/.test(prev.tagName)) return prev.textContent.trim();
      const heads = prev.querySelectorAll("h1, h2, h3, h4, h5, h6");
      if (heads.length) return heads[heads.length - 1].textContent.trim();
      prev = prev.previousElementSibling;
    }
    node = node.parentElement;
  }
  return "Details";
}

function nameTables(root) {
  const tables = [...root.querySelectorAll("table.data")];
  const headings = tables.map((table) => nearestHeading(table));
  const groups = new Map();
  headings.forEach((heading) => groups.set(heading, (groups.get(heading) || 0) + 1));
  const seen = new Map();
  tables.forEach((table, i) => {
    const heading = headings[i];
    if (!table.tHead || !table.tHead.rows[0]) return;
    const cols = [...table.tHead.rows[0].cells].map((cell) => cell.textContent.trim());
    let text = heading;
    if (groups.get(heading) > 1) {
      const n = (seen.get(heading) || 0) + 1;
      seen.set(heading, n);
      text = heading + ", table " + n + " (" + cols.join(", ") + ")";
    }
    const cap = h("caption", { class: "sr", id: "caption-" + (++captionSeq) }, text);
    table.prepend(cap);
  });
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fillCell(td, cell, label) {
  td.dataset.label = label;
  if (cell && typeof cell === "object") {
    const tone = cell.tone ? "tone tone-" + cell.tone : "tone";
    td.append(h("span", { class: tone }, cell.text ?? ""));
    return;
  }
  const s = cell == null ? "" : String(cell);
  if (/^https?:\/\//.test(s)) {
    td.append(newTab(s, {}, s));
    return;
  }
  td.textContent = s;
}

function renderTable(node) {
  const cols = node.p.columns || [];
  const table = h("table", { class: "data" });
  const thead = h("thead");
  const hr = h("tr");
  cols.forEach((c) => hr.append(h("th", { scope: "col" }, c)));
  thead.append(hr);
  const tb = h("tbody");
  (node.p.rows || []).forEach((row) => {
    const tr = h("tr");
    row.forEach((cell, i) => {
      const cellEl = i === 0 ? h("th", { scope: "row" }) : h("td");
      fillCell(cellEl, cell, cols[i] || "");
      tr.append(cellEl);
    });
    tb.append(tr);
  });
  table.append(thead, tb);
  return h("div", { class: "table-wrap" }, table);
}

function renderMonth(node) {
  const ym = node.p.month;
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const days = new Date(y, m, 0).getDate();
  const byDay = new Map();
  (node.p.events || []).forEach((ev) => {
    const d = Number(String(ev.date).slice(8, 10));
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(ev.title);
  });
  const grid = h("div", { class: "cal" });
  DOW.forEach((d) => grid.append(h("span", { class: "dow" }, d)));
  for (let i = 0; i < first.getDay(); i++) grid.append(h("span", { "aria-hidden": "true" }));
  for (let d = 1; d <= days; d++) {
    const titles = byDay.get(d) || [];
    const cell = h("div", {
      class: "day" + (titles.length ? " has" : ""),
    }, h("strong", null, String(d)));
    titles.forEach((t) => cell.append(h("em", null, t)));
    grid.append(cell);
  }
  return h("div", { class: "month" }, h("h3", null, MONTHS[m - 1] + " " + y), grid);
}

function render(node, level) {
  if (node == null || node === false) return document.createTextNode("");
  if (typeof node === "string" || typeof node === "number") return document.createTextNode(String(node));
  const t = node.t;
  const p = node.p || {};
  const kids = () => (node.c || []).map((c) => render(c, level));
  if (t === "frag") return h("div", null, ...kids());
  if (t === "Text") return h("p", { class: "prose" }, ...(node.c || []).map((c) => render(c, level)));
  if (t === "Section") {
    const id = slug(p.heading || "section");
    return h("section", { class: "block", id }, h(headingTag(level), null, p.heading || ""), ...(node.c || []).map((c) => render(c, level + 1)));
  }
  if (t === "Callout") {
    return h("aside", { class: "callout" + (p.tone === "warning" ? " warning" : "") },
      p.lead ? h("span", { class: "leadline" }, p.lead) : "",
      ...(node.c || []).map((c) => typeof c === "string" ? h("p", { class: "prose" }, c) : render(c, level)));
  }
  if (t === "Quote") {
    return h("blockquote", { class: "quote" }, ...(node.c || []).map((c) => render(c, level)), p.cite ? h("cite", null, p.cite) : "");
  }
  if (t === "Steps") {
    const ol = h("ol", { class: "steps", role: "list" });
    (p.steps || []).forEach((s, i) => {
      const li = h("li");
      const body = h("div", null, h("strong", null, s.title || ""), s.detail ? h("p", { class: "prose" }, s.detail) : "");
      const id = "done-" + (++stepSeq);
      const label = h("label", { class: "check noprint", for: id });
      const input = h("input", { type: "checkbox", id, "data-step": String(i) });
      label.append(input, document.createTextNode(" Done on this device"));
      body.append(label);
      li.append(body);
      ol.append(li);
    });
    return ol;
  }
  if (t === "Rows") {
    const box = h("div", { class: "stack" });
    (p.rows || []).forEach((r) => {
      const card = h("article", { class: "rowcard" });
      if (r.lead) card.append(h("div", { class: "lead" }, r.lead));
      if (r.title) card.append(h("strong", null, r.title));
      if (r.detail) card.append(h("p", { class: "prose" }, r.detail));
      if (r.meta) card.append(h("div", { class: "note" }, r.meta));
      if (r.status && r.status.label) {
        card.append(h("span", { class: "tone tone-" + (r.status.tone || "neutral") }, r.status.label));
      }
      box.append(card);
    });
    return box;
  }
  if (t === "Table") return renderTable(node);
  if (t === "LinkCards") {
    const grid = h("ul", { class: "link-grid", role: "list" });
    (p.links || []).forEach((link) => {
      const a = newTab(link.href, { class: "link-card" },
        h("strong", null, link.title || link.href),
        h("small", null, [link.site, link.date].filter(Boolean).join(" · ")));
      grid.append(h("li", null, a));
    });
    return grid;
  }
  if (t === "BulletList") {
    const ul = h("ul", { class: "bullets" });
    (p.items || []).forEach((item) => {
      const li = h("li");
      const s = String(item);
      const m = s.match(/^(.*?)(https?:\/\/\S+)$/);
      if (m) {
        li.append(m[1], newTab(m[2], {}, m[2]));
      } else li.textContent = s;
      ul.append(li);
    });
    return ul;
  }
  if (t === "Properties") {
    const dl = h("dl", { class: "props" });
    (p.items || []).forEach((item) => {
      dl.append(h("div", null, h("dt", null, item.label || ""), h("dd", null, item.value || "")));
    });
    return dl;
  }
  if (t === "TableOfContents") {
    const nav = h("nav", { class: "noprint", "aria-label": "On this page" });
    const list = h("ul", { class: "toc", role: "list" });
    (p.items || []).forEach((item) => {
      list.append(h("li", null, h("a", { class: "chip", href: "#" + slug(item.label) }, item.label)));
    });
    nav.append(list);
    return nav;
  }
  if (t === "Segmented") {
    const options = p.options || [];
    const label = options.includes("Usable") ? "Filter open windows" : options.includes("Road trip") ? "Filter trip ideas" : "Filter";
    const group = h("div", { class: "seg noprint" });
    (p.options || []).forEach((opt) => {
      const b = h("button", { type: "button", class: "chip", "data-value": opt }, opt);
      if (opt === p.value) b.setAttribute("aria-pressed", "true");
      else b.setAttribute("aria-pressed", "false");
      group.append(b);
    });
    return h("search", { "aria-label": label }, group);
  }
  if (t === "Grid") {
    return h("div", { class: "grid-block", "data-cols": String(p.columns || 1) }, ...(node.c || []).map((c) => render(c, level)));
  }
  if (t === "MonthView") return renderMonth(node);
  const box = h("div");
  (node.c || []).forEach((c) => box.append(render(c, level)));
  return box;
}

export function renderPage(node, mount) {
  mount.replaceChildren();
  const p = node.p || {};
  const hero = h("header", { class: "hero-block wrap" },
    h("h1", { id: "page-title", tabindex: "-1" }, p.title || ""),
    p.summary ? h("p", { class: "lede" }, p.summary) : "");
  const body = h("div", { class: "doc wrap" });
  (node.c || []).forEach((c) => body.append(render(c, 2)));
  mount.append(hero, body);
  if (p.sources && p.sources.length) {
    const list = h("ul", { class: "bullets" });
    p.sources.forEach((src) => list.append(h("li", null, newTab(src, {}, src))));
    body.append(h("section", { class: "sources block" }, h("h2", null, "Sources"), list));
  }
  nameTables(body);
}
