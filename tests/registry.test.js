import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { filterEntries, sortEntries, nextId, validateEntry, todayISO } from "../public/js/registry.js";

const data = JSON.parse(readFileSync(new URL("../public/data/registry.json", import.meta.url)));
const { entries, meta } = data;

test("sample data is flagged and entries are well formed", () => {
  assert.equal(meta.isSampleData, true);
  const ids = new Set();
  for (const e of entries) {
    assert.match(e.id, /^REG-\d{4}$/);
    assert.ok(!ids.has(e.id), "duplicate id " + e.id);
    ids.add(e.id);
    assert.ok(meta.categories.includes(e.category), e.id + " category");
    assert.ok(meta.statuses.includes(e.status), e.id + " status");
    assert.match(e.registeredOn, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test("search matches name, keyword, and multiple terms", () => {
  assert.equal(filterEntries(entries, { query: "printer" }).length, 1);
  assert.equal(filterEntries(entries, { query: "TOOL library catalog" }).length, 1);
  assert.equal(filterEntries(entries, { query: "tool library" }).length, 2);
  assert.equal(filterEntries(entries, { query: "zzzz" }).length, 0);
});

test("filters by category and status", () => {
  const eq = filterEntries(entries, { category: "Equipment" });
  assert.ok(eq.length > 0 && eq.every((e) => e.category === "Equipment"));
  const retired = filterEntries(entries, { status: "Retired", category: "Software" });
  assert.equal(retired.length, 2);
});

test("sorting", () => {
  assert.equal(sortEntries(entries, "name-asc")[0].name, [...entries.map((e) => e.name)].sort((a, b) => a.localeCompare(b))[0]);
  const newest = sortEntries(entries, "date-desc");
  assert.ok(newest[0].registeredOn >= newest[1].registeredOn);
  const oldest = sortEntries(entries, "date-asc");
  assert.ok(oldest[0].registeredOn <= oldest[1].registeredOn);
});

test("nextId continues the sequence", () => {
  assert.equal(nextId(entries), "REG-0011");
  assert.equal(nextId([]), "REG-0001");
});

test("validation", () => {
  const good = { name: "Label printer", category: "Equipment", status: "Active", description: "Prints shipping labels.", contactEmail: "a@b.co" };
  assert.equal(validateEntry(good, meta).valid, true);
  const bad = validateEntry({ name: "x", category: "Nope", status: "", description: "short", contactEmail: "not-an-email" }, meta);
  assert.equal(bad.valid, false);
  assert.deepEqual(Object.keys(bad.errors).sort(), ["category", "contactEmail", "description", "name", "status"]);
});

test("todayISO formats local date", () => {
  assert.equal(todayISO(new Date(2026, 0, 5)), "2026-01-05");
});
