// Data access layer. The UI only talks to this module.
//
// Published entries come from data/registry.json (static, read-only).
// Submissions are stored ONLY in this browser's localStorage. They are not
// shared with other visitors and are not saved to the repository.

import { nextId, todayISO } from "./registry.js";

const KEY = "registry.localSubmissions.v1";

function safeStorage() {
  try {
    const t = "__t";
    window.localStorage.setItem(t, t);
    window.localStorage.removeItem(t);
    return window.localStorage;
  } catch {
    return null;
  }
}

export async function loadPublished(baseUrl) {
  // Relative URL keeps this working from a GitHub Pages project subpath.
  const res = await fetch(new URL("data/registry.json", baseUrl), { cache: "no-cache" });
  if (!res.ok) throw new Error(`Could not load registry data (HTTP ${res.status}).`);
  const json = await res.json();
  if (!json || !Array.isArray(json.entries)) throw new Error("Registry data file is malformed.");
  return json;
}

export function loadLocal() {
  const s = safeStorage();
  if (!s) return [];
  try {
    const arr = JSON.parse(s.getItem(KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function addLocal(fields, publishedEntries) {
  const s = safeStorage();
  if (!s) throw new Error("This browser is blocking local storage, so the entry could not be kept even on this device.");
  const local = loadLocal();
  const entry = {
    ...fields,
    id: nextId([...publishedEntries, ...local]),
    registeredOn: todayISO(),
    isLocal: true,
  };
  s.setItem(KEY, JSON.stringify([...local, entry]));
  return entry;
}

export function removeLocal(id) {
  const s = safeStorage();
  if (!s) return;
  s.setItem(KEY, JSON.stringify(loadLocal().filter((e) => e.id !== id)));
}

export function clearLocal() {
  const s = safeStorage();
  if (s) s.removeItem(KEY);
}
