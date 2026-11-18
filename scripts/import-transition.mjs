// One-off import of the FootprintAI transition plan into FootprintOS.
//
//   node --env-file=.env.local scripts/import-transition.mjs <path to footprintai-transition-actions.json>
//
// Run on the owner's laptop only: it uses SUPABASE_SECRET_KEY from .env.local
// and the plan file from the owner's own copy. The plan is never stored in
// this repository (it's public, and some actions are board-only).
//
// Safe to run again: streams, phases, weeks and gates are matched on their
// key / number / name and date; actions on their ref (T-001…). Actions that
// already exist are left exactly as they are, so later changes are kept.
// Owners are matched to the Microsoft 365 staff list: DJ is Darren Jacobs,
// everyone else by first name. Unmatched owners are left empty and listed.

import { readFileSync } from "node:fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const file = process.argv[2];
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are needed (run with --env-file=.env.local)");
if (!file) throw new Error("Give the path to footprintai-transition-actions.json");

const plan = JSON.parse(readFileSync(file, "utf8"));
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

async function rest(path, init = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path}: ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}
const upsert = (table, rows, onConflict, ignoreDuplicates = false) =>
  rest(`${table}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: { Prefer: `resolution=${ignoreDuplicates ? "ignore" : "merge"}-duplicates,return=representation` },
    body: JSON.stringify(rows),
  });

// ─── Programme ──────────────────────────────────────────────────────────────
await upsert("transition_streams", plan.streams.map((s) => ({ key: s.key, name: s.name, subtitle: s.subtitle, description: s.description, sort: s.sort })), "key");
await upsert("transition_phases", plan.phases.map((p) => ({ number: p.number, name: p.name, label: p.label })), "number");
await upsert("transition_weeks", plan.weeks.map((w) => ({ number: w.number, meeting_date: w.meeting_date, label: w.label, phase: w.phase })), "number");
await upsert("transition_gates", plan.gates.map((g) => ({ name: g.name, date: g.date, description: g.description, is_launch: !!g.is_launch })), "name,date");

// ─── Owners from the staff list ─────────────────────────────────────────────
const staff = await rest("staff_directory?select=id,display_name&in_entra=eq.true");
const first = (n) => (n ?? "").trim().split(/\s+/)[0].toLowerCase();
function findOwner(short) {
  if (short === "DJ") return staff.filter((s) => (s.display_name ?? "").toLowerCase() === "darren jacobs");
  return staff.filter((s) => first(s.display_name) === short.toLowerCase());
}
const unmatched = new Set();
const ownerId = (short) => {
  const hits = findOwner(short);
  if (hits.length === 1) return hits[0].id;
  unmatched.add(`${short} (${hits.length ? "more than one match" : "no match"})`);
  return null;
};

// ─── Actions (new ones only; existing refs are left alone) ──────────────────
const created = await upsert(
  "transition_actions",
  plan.actions.map((a, i) => ({
    ref: a.ref,
    phase: a.phase,
    stream: a.stream,
    title: a.title,
    detail: a.detail ?? null,
    owner_id: ownerId(a.owner_short),
    due_date: a.due_date,
    status: "not_started",
    visibility: a.visibility === "board" ? "board" : "all",
    sort: i,
  })),
  "ref",
  true,
);

// ─── The invite list: Mitch, Jyron and Toby to start ────────────────────────
const members = ["Mitch", "Jyron", "Toby"].map((n) => ({ n, id: ownerId(n) })).filter((m) => m.id);
await upsert("transition_members", members.map((m) => ({ directory_id: m.id })), "directory_id", true);

// ─── Summary ────────────────────────────────────────────────────────────────
const all = await rest("transition_actions?select=ref,visibility,owner_id");
const counts = {};
for (const a of all) {
  const name = staff.find((s) => s.id === a.owner_id)?.display_name ?? "(no owner)";
  counts[name] = (counts[name] ?? 0) + 1;
}
const n = async (t) => (await rest(`${t}?select=*`)).length;
console.log("Streams:", await n("transition_streams"), "· Phases:", await n("transition_phases"), "· Weeks:", await n("transition_weeks"), "· Gates:", await n("transition_gates"));
console.log("Actions:", all.length, `(${(created ?? []).length} added this run) · board-only:`, all.filter((a) => a.visibility === "board").length);
console.log("Owners:", Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", "));
console.log("Invite list:", members.map((m) => m.n).join(", ") || "(none matched)");
if (unmatched.size) console.log("Couldn't match (left empty):", [...unmatched].join(", "));
