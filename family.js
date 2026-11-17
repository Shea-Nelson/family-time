import { renderPage } from "./shelf/doc.js";

const app = document.querySelector("#app");

function showLoadError() {
  const p = document.createElement("p");
  p.className = "noscript";
  p.textContent = "The plan could not be loaded. Refresh the page to try again.";
  app.replaceChildren(p);
}

let data;
try {
  const response = await fetch(new URL("data/family.json", import.meta.url).href);
  if (!response.ok) throw new Error("family");
  data = await response.json();
} catch (e) {
  showLoadError();
}

if (data && data.tree) {
try {
const host = document.createElement("div");
app.replaceChildren(host);
renderPage(data.tree, host);

const wins = new Map(data.windows.map((w) => [w.dates, w]));
const ideas = new Map(data.ideas.map((i) => [i.name, i]));

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch (e) { return fallback; }
}
function write(key, v) { localStorage.setItem(key, JSON.stringify(v)); }

function windowMatch(w, mode) {
  if (mode === "All") return true;
  if (mode === "Usable") return w.status !== "Busy" && w.status !== "Taken";
  if (mode === "Weekends") return w.type === "Weekend" || w.type === "Weekday off";
  if (mode === "Long weekends") return w.type === "Long weekend";
  if (mode === "Breaks & summer") return w.type === "Break" || w.type === "Summer";
  return true;
}

function wire(table, kind) {
  const rows = [...table.querySelectorAll("tbody tr")];
  if (kind === "windows") {
    rows.forEach((tr) => {
      const date = tr.cells[0].textContent;
      const w = wins.get(date);
      if (!w) return;
      tr.dataset.dates = w.dates;
      const td = document.createElement("td");
      td.dataset.label = "On this device";
      const label = document.createElement("label");
      label.className = "check noprint";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.id = "maybe-" + w.dates.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      input.dataset.dates = w.dates;
      label.htmlFor = input.id;
      const saved = read("family-maybe", {});
      input.checked = !!saved[w.dates];
      input.addEventListener("change", () => {
        const all = read("family-maybe", {});
        all[w.dates] = input.checked;
        write("family-maybe", all);
      });
      label.append(input, document.createTextNode(" Saved"));
      td.append(label);
      tr.append(td);
    });
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = "On this device";
    table.querySelector("thead tr").append(th);
  }
  return rows;
}

const segs = [...document.querySelectorAll(".seg")];
const tables = [...document.querySelectorAll("table.data")];
const winTable = tables.find((t) => t.querySelector("th") && t.querySelector("th").textContent === "Dates");
const ideaTable = tables.find((t) => {
  const heads = [...t.querySelectorAll("th")].map((th) => th.textContent);
  return heads[0] === "Idea";
});

function bindSeg(seg, rows, modeKey, fallback, test) {
  let mode = read(modeKey, fallback);
  const buttons = [...seg.querySelectorAll("button")];
  if (!buttons.some((b) => b.dataset.value === mode)) mode = fallback;
  const live = document.createElement("p");
  live.className = "note";
  live.setAttribute("aria-live", "polite");
  seg.after(live);
  function apply() {
    buttons.forEach((b) => b.setAttribute("aria-pressed", b.dataset.value === mode ? "true" : "false"));
    let shown = 0;
    rows.forEach((tr) => {
      const ok = test(tr, mode);
      tr.hidden = !ok;
      if (ok) shown += 1;
    });
    live.textContent = "Showing " + shown + " of " + rows.length + ".";
    write(modeKey, mode);
  }
  buttons.forEach((b) => b.addEventListener("click", () => { mode = b.dataset.value; apply(); }));
  apply();
}

if (winTable) {
  const rows = wire(winTable, "windows");
  const seg = segs.find((s) => [...s.querySelectorAll("button")].some((b) => b.dataset.value === "Usable"));
  if (seg) bindSeg(seg, rows, "family-windows", "Usable", (tr, mode) => {
    const w = wins.get(tr.dataset.dates || tr.cells[0].textContent);
    return w ? windowMatch(w, mode) : true;
  });
}
if (ideaTable) {
  const rows = [...ideaTable.querySelectorAll("tbody tr")];
  const seg = segs.find((s) => [...s.querySelectorAll("button")].some((b) => b.dataset.value === "Road trip"));
  if (seg) bindSeg(seg, rows, "family-ideas", "All", (tr, mode) => {
    if (mode === "All") return true;
    const kind = tr.cells[1] ? tr.cells[1].textContent : "";
    return kind === mode;
  });
}

function syncTableScroll() {
  document.querySelectorAll(".table-wrap").forEach((wrap) => {
    const cap = wrap.querySelector("caption");
    const overflows = wrap.scrollWidth > wrap.clientWidth + 1;
    if (overflows && cap && cap.id) {
      wrap.tabIndex = 0;
      wrap.setAttribute("role", "region");
      wrap.setAttribute("aria-labelledby", cap.id);
    } else {
      wrap.removeAttribute("role");
      wrap.removeAttribute("aria-labelledby");
      wrap.removeAttribute("tabindex");
    }
  });
}
let scrollTimer = 0;
window.addEventListener("resize", () => {
  window.clearTimeout(scrollTimer);
  scrollTimer = window.setTimeout(syncTableScroll, 150);
});
syncTableScroll();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncTableScroll);
} catch (e) {
  showLoadError();
}
}
