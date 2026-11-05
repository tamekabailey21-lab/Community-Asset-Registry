// Pure data logic: no DOM access, so it can be unit tested in Node.

export function filterEntries(entries, { query = "", category = "", status = "" } = {}) {
  const q = query.trim().toLowerCase();
  return entries.filter((e) => {
    if (category && e.category !== category) return false;
    if (status && e.status !== status) return false;
    if (!q) return true;
    const haystack = [e.id, e.name, e.description, e.reference, e.category, e.contactName]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return q.split(/\s+/).every((term) => haystack.includes(term));
  });
}

const SORTERS = {
  "name-asc": (a, b) => a.name.localeCompare(b.name),
  "name-desc": (a, b) => b.name.localeCompare(a.name),
  "date-desc": (a, b) => b.registeredOn.localeCompare(a.registeredOn),
  "date-asc": (a, b) => a.registeredOn.localeCompare(b.registeredOn),
};

export const SORT_OPTIONS = [
  { value: "name-asc", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
  { value: "date-desc", label: "Newest first" },
  { value: "date-asc", label: "Oldest first" },
];

export function sortEntries(entries, key = "name-asc") {
  const fn = SORTERS[key] || SORTERS["name-asc"];
  return [...entries].sort(fn);
}

export function nextId(entries) {
  const max = entries.reduce((m, e) => {
    const n = parseInt(String(e.id).replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return "REG-" + String(max + 1).padStart(4, "0");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Returns { valid, errors: { field: message }, value } where value is the cleaned entry fields.
export function validateEntry(input, { categories, statuses }) {
  const v = {
    name: (input.name || "").trim(),
    category: (input.category || "").trim(),
    description: (input.description || "").trim(),
    status: (input.status || "").trim(),
    contactName: (input.contactName || "").trim(),
    contactEmail: (input.contactEmail || "").trim(),
    reference: (input.reference || "").trim(),
  };
  const errors = {};
  if (v.name.length < 3) errors.name = "Enter a name of at least 3 characters.";
  else if (v.name.length > 100) errors.name = "Keep the name under 100 characters.";
  if (!categories.includes(v.category)) errors.category = "Choose a category.";
  if (!statuses.includes(v.status)) errors.status = "Choose a status.";
  if (v.description.length < 10) errors.description = "Describe the entry in at least 10 characters.";
  else if (v.description.length > 600) errors.description = "Keep the description under 600 characters.";
  if (v.contactEmail && !EMAIL_RE.test(v.contactEmail)) errors.contactEmail = "Enter a valid email address or leave it blank.";
  if (v.reference.length > 40) errors.reference = "Keep the reference under 40 characters.";
  return { valid: Object.keys(errors).length === 0, errors, value: v };
}

export function formatDate(iso) {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function todayISO(now = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
