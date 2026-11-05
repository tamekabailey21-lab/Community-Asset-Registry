import { CONFIG } from "./config.js";
import { loadPublished, loadLocal, addLocal, removeLocal } from "./store.js";
import { filterEntries, sortEntries, SORT_OPTIONS, validateEntry, formatDate } from "./registry.js";

const BASE_URL = new URL("./", import.meta.url).href.replace(/js\/$/, "");
const $main = document.getElementById("main");
const $live = document.getElementById("live");

const state = { meta: null, published: [], error: null };

/* ---------- tiny DOM helper (text is always set via textContent: no HTML injection) ---------- */
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

const allEntries = () => [...state.published, ...loadLocal()];
const announce = (msg) => { $live.textContent = ""; setTimeout(() => ($live.textContent = msg), 50); };

function badge(status) { return h("span", { class: `badge ${status}` }, status); }
function riskBadge(level) {
  return level ? h("span", { class: `badge risk-${level}`, title: "Risk level" }, `${level} risk`) : null;
}

/* ---------- routing (hash based, so it works on any GitHub Pages subpath) ---------- */
function parseHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, query = ""] = raw.split("?");
  return { parts: path.split("/").filter(Boolean), params: new URLSearchParams(query) };
}

function setActiveNav(name) {
  document.querySelectorAll(".site-nav a").forEach((a) => {
    if (a.dataset.route === name) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

async function route() {
  const { parts, params } = parseHash();
  document.getElementById("site-nav").classList.remove("open");
  document.getElementById("nav-toggle").setAttribute("aria-expanded", "false");

  if (state.error) { renderFatal(state.error); return; }
  if (!state.meta) return;

  const [first, second] = parts;
  let name = "home", title = CONFIG.siteName;
  $main.replaceChildren();

  if (!first) { renderHome(); }
  else if (first === "directory") { name = "directory"; title = "Directory"; renderDirectory(params); }
  else if (first === "entry" && second) { name = "directory"; title = "Entry " + second; renderDetail(decodeURIComponent(second)); }
  else if (first === "submit") { name = "submit"; title = "Add entry"; renderSubmit(); }
  else if (first === "about") { name = "about"; title = "About"; renderAbout(); }
  else { title = "Not found"; renderNotFound(); }

  setActiveNav(name);
  document.title = name === "home" ? CONFIG.siteName : `${title} · ${CONFIG.siteName}`;
  window.scrollTo(0, 0);
  $main.focus({ preventScroll: true });
}

/* ---------- pages ---------- */
function renderHome() {
  const entries = allEntries();
  const count = (s) => entries.filter((e) => e.status === s).length;
  $main.append(
    h("section", { class: "hero" },
      h("h1", {}, "Find, track, and propose community assets"),
      h("p", { class: "lead" }, "A searchable registry of shared equipment, software, documents, and facilities, with a clear status and a point of contact for each entry."),
      h("div", { class: "hero-actions" },
        h("a", { class: "btn", href: "#/directory" }, "Browse the directory"),
        h("a", { class: "btn secondary", href: "#/submit" }, "Add an entry"))),
    h("div", { class: "stats" },
      stat(entries.length, "Total entries"),
      stat(count("Active"), "Active"),
      stat(count("Pending"), "Pending"),
      stat(count("Retired"), "Retired"),
      stat(entries.filter((e) => e.riskLevel === "High" || e.riskLevel === "Critical").length, "High or critical risk")),
    h("h2", {}, "Recently registered"),
    cardGrid(sortEntries(entries, "date-desc").slice(0, 3)));
}

function stat(n, label) {
  return h("div", { class: "stat" }, h("div", { class: "num" }, String(n)), h("div", { class: "label" }, label));
}

function cardGrid(entries) {
  return h("ul", { class: "grid" }, entries.map((e) =>
    h("li", {},
      h("article", { class: "card" },
        h("div", { class: "card-top" },
          h("span", { class: "badge cat" }, e.category),
          h("span", { class: "badges" }, riskBadge(e.riskLevel), badge(e.status))),
        h("h3", {}, h("a", { href: `#/entry/${encodeURIComponent(e.id)}` }, e.name)),
        h("p", { class: "desc" }, e.description),
        h("div", { class: "meta" },
          h("span", {}, e.id),
          e.isLocal ? h("span", { class: "badge local" }, "Only on this device") : null,
          h("span", {}, formatDate(e.registeredOn)))))));
}

function renderDirectory(params) {
  const { categories, statuses } = state.meta;
  const riskLevels = state.meta.riskLevels;
  const f = { query: params.get("q") || "", category: params.get("category") || "", status: params.get("status") || "", risk: params.get("risk") || "", sort: params.get("sort") || "name-asc" };

  const select = (id, label, options, value, all) =>
    h("div", {},
      h("label", { for: id }, label),
      h("select", { id }, h("option", { value: "" }, all), options.map((o) => h("option", { value: o.value ?? o, selected: (o.value ?? o) === value }, o.label ?? o))));

  const $results = h("div", { id: "results" });
  const $count = h("p", { class: "muted", role: "status", id: "count" });

  const $search = h("input", { id: "q", type: "search", placeholder: "Name, ID, reference, keyword…", value: f.query, autocomplete: "off" });
  const sortSel = h("div", {},
    h("label", { for: "sort" }, "Sort by"),
    h("select", { id: "sort" }, SORT_OPTIONS.map((o) => h("option", { value: o.value, selected: o.value === f.sort }, o.label))));
  const catSel = select("category", "Category", categories, f.category, "All categories");
  const statSel = select("status", "Status", statuses, f.status, "All statuses");
  const riskSel = select("risk", "Risk level", riskLevels, f.risk, "All risk levels");

  const resetBtn = h("button", { class: "btn secondary small", type: "button", onclick: () => {
    $search.value = ""; catSel.querySelector("select").value = ""; statSel.querySelector("select").value = ""; riskSel.querySelector("select").value = ""; sortSel.querySelector("select").value = "name-asc";
    update(true);
  } }, "Reset filters");

  function update(announceResult) {
    f.query = $search.value;
    f.category = catSel.querySelector("select").value;
    f.status = statSel.querySelector("select").value;
    f.risk = riskSel.querySelector("select").value;
    f.sort = sortSel.querySelector("select").value;

    const p = new URLSearchParams();
    if (f.query) p.set("q", f.query);
    if (f.category) p.set("category", f.category);
    if (f.status) p.set("status", f.status);
    if (f.risk) p.set("risk", f.risk);
    if (f.sort !== "name-asc") p.set("sort", f.sort);
    const qs = p.toString();
    history.replaceState(null, "", `#/directory${qs ? "?" + qs : ""}`);

    const total = allEntries();
    const list = sortEntries(filterEntries(total, f), f.sort);
    $count.textContent = `Showing ${list.length} of ${total.length} entries`;
    if (announceResult) announce($count.textContent);
    $results.replaceChildren(list.length ? cardGrid(list) : h("div", { class: "empty" },
      h("h2", {}, "No entries match"),
      h("p", { class: "muted" }, "Try a different keyword or clear the filters."),
      h("button", { class: "btn secondary", type: "button", onclick: () => resetBtn.click() }, "Clear filters")));
  }

  $main.append(
    h("h1", {}, "Registry directory"),
    h("div", { class: "controls", role: "search" },
      h("div", { class: "search" }, h("label", { for: "q" }, "Search"), $search),
      catSel, statSel, riskSel, sortSel),
    h("div", { class: "result-bar" }, $count, resetBtn),
    $results);

  $search.addEventListener("input", () => update(false));
  $main.querySelectorAll("select").forEach((s) => s.addEventListener("change", () => update(true)));
  update(false);
}

function renderDetail(id) {
  const e = allEntries().find((x) => x.id === id);
  if (!e) { renderNotFound(`No entry with ID ${id} exists.`); return; }
  const mail = e.contactEmail ? h("a", { href: `mailto:${e.contactEmail}` }, e.contactEmail) : "Not provided";

  $main.append(
    h("p", { class: "breadcrumb" }, h("a", { href: "#/directory" }, "← Back to directory")),
    h("article", { class: "panel" },
      h("div", { class: "card-top" }, h("span", { class: "badge cat" }, e.category), h("span", { class: "badges" }, riskBadge(e.riskLevel), badge(e.status))),
      h("h1", {}, e.name),
      h("p", {}, e.description),
      h("section", { class: "risk-box", "aria-labelledby": "risk-h" },
        h("h2", { id: "risk-h" }, "Risk factors"),
        e.riskLevel ? h("p", {}, "Overall risk level: ", h("strong", {}, e.riskLevel)) : h("p", { class: "muted" }, "No risk level recorded."),
        (e.riskFactors || []).length
          ? h("ul", { class: "risk-list" }, e.riskFactors.map((r) => h("li", {}, r)))
          : h("p", { class: "muted" }, "No specific risk factors listed.")),
      e.isLocal ? h("div", { class: "notice warn" }, "This entry exists only in this browser. It has not been published and other visitors cannot see it.") : null,
      h("dl", { class: "details" },
        h("dt", {}, "Entry ID"), h("dd", {}, e.id),
        h("dt", {}, "Registered"), h("dd", {}, formatDate(e.registeredOn)),
        h("dt", {}, "Reference"), h("dd", {}, e.reference || "None"),
        h("dt", {}, "Contact"), h("dd", {}, e.contactName || "Not provided"),
        h("dt", {}, "Email"), h("dd", {}, mail)),
      h("div", { class: "form-actions" },
        h("button", { class: "btn secondary", type: "button", onclick: (ev) => copyText(entryUrl(e.id), ev.currentTarget, "Link copied") }, "Copy link"),
        e.isLocal ? h("button", { class: "btn danger", type: "button", onclick: () => {
          if (confirm(`Remove "${e.name}" from this device?`)) { removeLocal(e.id); announce("Entry removed"); location.hash = "#/directory"; }
        } }, "Remove from this device") : null)));
}

const entryUrl = (id) => `${location.origin}${location.pathname}#/entry/${encodeURIComponent(id)}`;

async function copyText(text, btn, okLabel) {
  const old = btn.textContent;
  try { await navigator.clipboard.writeText(text); btn.textContent = okLabel; }
  catch { btn.textContent = "Copy failed"; }
  announce(btn.textContent);
  setTimeout(() => (btn.textContent = old), 1800);
}

function renderSubmit() {
  const { categories, statuses, riskLevels } = state.meta;
  const $form =h("form", { class: "panel", novalidate: true, "aria-labelledby": "form-title" });
  const $status = h("div", { id: "form-status", tabindex: "-1" });

  const field = (name, label, control, { full = false, required = false, hint = "" } = {}) =>
    h("div", { class: full ? "full" : "" },
      h("label", { for: name }, label, required ? h("span", { class: "req", "aria-hidden": "true" }, " *") : ""),
      control,
      hint ? h("p", { class: "hint", id: `${name}-hint` }, hint) : null,
      h("p", { class: "field-error", id: `${name}-err`, hidden: true }));

  const sel = (name, opts) => h("select", { id: name, name, required: true }, h("option", { value: "" }, "Select…"), opts.map((o) => h("option", { value: o }, o)));

  $form.append(
    h("div", { class: "form-grid" },
      field("name", "Name", h("input", { id: "name", name: "name", maxlength: "100", required: true, autocomplete: "off" }), { full: true, required: true }),
      field("category", "Category", sel("category", categories), { required: true }),
      field("status", "Status", sel("status", statuses), { required: true }),
      field("description", "Description", h("textarea", { id: "description", name: "description", maxlength: "600", required: true }), { full: true, required: true, hint: "10 to 600 characters." }),
      field("riskLevel", "Risk level", sel("riskLevel", riskLevels), { required: true }),
      field("riskFactors", "Risk factors", h("textarea", { id: "riskFactors", name: "riskFactors", maxlength: "1100" }), { required: false, hint: "Optional. One factor per line, up to 10." }),
      field("contactName", "Contact name", h("input", { id: "contactName", name: "contactName", autocomplete: "name" })),
      field("contactEmail", "Contact email", h("input", { id: "contactEmail", name: "contactEmail", type: "email", autocomplete: "email" })),
      field("reference", "Reference code", h("input", { id: "reference", name: "reference", maxlength: "40" }), { full: true, hint: "Optional internal code or serial number." })),
    h("div", { class: "form-actions" },
      h("button", { class: "btn", type: "submit" }, "Save on this device"),
      h("button", { class: "btn secondary", type: "reset" }, "Clear form")));

  $form.addEventListener("reset", () => { clearErrors($form); $status.replaceChildren(); });

  $form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    clearErrors($form);
    $status.replaceChildren();
    const data = Object.fromEntries(new FormData($form).entries());
    const result = validateEntry(data, state.meta);

    if (!result.valid) {
      for (const [k, msg] of Object.entries(result.errors)) {
        const input = $form.querySelector(`#${k}`);
        const err = $form.querySelector(`#${k}-err`);
        input.setAttribute("aria-invalid", "true");
        input.setAttribute("aria-describedby", err.id);
        err.textContent = msg; err.hidden = false;
      }
      $status.append(h("div", { class: "notice error", role: "alert" }, `Please fix ${Object.keys(result.errors).length} field(s) and try again.`));
      $form.querySelector("[aria-invalid='true']").focus();
      return;
    }

    try {
      const saved = addLocal(result.value, state.published);
      $form.reset();
      $status.append(
        h("div", { class: "notice success", role: "status" },
          h("p", {}, h("strong", {}, `Saved as ${saved.id} in this browser only.`)),
          h("p", {}, "It is not published. Other visitors cannot see it, and clearing site data will delete it. To make it part of the shared registry, send it to the maintainers using one of the options below."),
          h("div", { class: "form-actions" },
            h("a", { class: "btn small", href: `#/entry/${encodeURIComponent(saved.id)}` }, "View entry"),
            h("button", { class: "btn secondary small", type: "button", onclick: (e2) => copyText(entryJson(saved), e2.currentTarget, "JSON copied") }, "Copy as JSON"),
            proposeLink(saved))));
      announce(`Entry ${saved.id} saved on this device`);
      $status.focus();
    } catch (err) {
      $status.append(h("div", { class: "notice error", role: "alert" }, "Could not save the entry. " + err.message));
    }
  });

  $main.append(
    h("h1", { id: "form-title" }, "Add an entry"),
    h("div", { class: "notice info" },
      h("p", {}, h("strong", {}, "Where submissions go: "), "this site is static, so it has no server database. Entries you add here are kept only in this browser. They are not shared and not saved to the repository."),
      h("p", {}, "To publish an entry, send it to the maintainers (copy the JSON or open a GitHub issue after saving), who add it to ", h("code", {}, "public/data/registry.json"), ".")),
    $status, $form);
}

function entryJson(e) {
  const { isLocal, ...rest } = e;
  return JSON.stringify(rest, null, 2);
}

function proposeLink(e) {
  if (!CONFIG.repository) return null;
  const body = "Please review this registry entry:\n\n```json\n" + entryJson(e) + "\n```\n";
  const url = `https://github.com/${CONFIG.repository}/issues/new?title=${encodeURIComponent("New registry entry: " + e.name)}&body=${encodeURIComponent(body)}`;
  return h("a", { class: "btn secondary small", href: url, target: "_blank", rel: "noopener noreferrer" }, "Propose via GitHub issue");
}

function clearErrors(form) {
  form.querySelectorAll("[aria-invalid]").forEach((el) => { el.removeAttribute("aria-invalid"); el.removeAttribute("aria-describedby"); });
  form.querySelectorAll(".field-error").forEach((el) => { el.textContent = ""; el.hidden = true; });
}

function renderAbout() {
  $main.append(
    h("h1", {}, "About this registry"),
    h("div", { class: "panel" },
      h("h2", {}, "Where the data comes from"),
      h("p", {}, "Published entries are read from a static file, ", h("code", {}, "data/registry.json"), ", that ships with the site. The entries currently shown are ", state.meta.isSampleData ? "fictional sample data." : "maintained by the registry administrators."),
      h("h2", {}, "What happens to submissions"),
      h("p", {}, "Entries added through the form are stored in your browser's local storage on this device only. GitHub Pages cannot receive form data, so nothing is sent to a server."),
      h("p", {}, "Local entries appear alongside published ones on this device. Remove them anytime from an entry's page."),
      h("h2", {}, "Privacy"),
      h("p", {}, "This site sets no cookies and uses no analytics. Contact details you type into the form never leave your browser unless you choose to copy or send them."),
      state.meta.note ? h("p", { class: "muted" }, state.meta.note) : null));
}

function renderNotFound(msg = "The page you asked for does not exist.") {
  $main.append(h("div", { class: "empty" }, h("h1", {}, "Not found"), h("p", { class: "muted" }, msg), h("a", { class: "btn", href: "#/directory" }, "Go to the directory")));
}

function renderFatal(err) {
  $main.replaceChildren(h("div", { class: "notice error", role: "alert" },
    h("h1", {}, "The registry could not be loaded"),
    h("p", {}, err.message),
    h("p", {}, "If you opened index.html directly from your disk, browsers block loading the data file. Serve the folder with a local web server instead (see the README)."),
    h("button", { class: "btn", type: "button", onclick: () => location.reload() }, "Try again")));
}

/* ---------- boot ---------- */
document.getElementById("nav-toggle").addEventListener("click", (ev) => {
  const nav = document.getElementById("site-nav");
  const open = nav.classList.toggle("open");
  ev.currentTarget.setAttribute("aria-expanded", String(open));
});
window.addEventListener("hashchange", route);

(async function init() {
  $main.replaceChildren(h("p", { class: "loading", role: "status" }, h("span", { class: "spinner", "aria-hidden": "true" }), "Loading registry…"));
  try {
    const data = await loadPublished(BASE_URL);
    state.published = data.entries;
    state.meta = { ...data.meta };
    document.getElementById("sample-banner").hidden = !data.meta.isSampleData;
  } catch (err) {
    state.error = err;
  }
  route();
})();
