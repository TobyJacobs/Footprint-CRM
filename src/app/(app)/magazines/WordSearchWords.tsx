"use client";

import { useState } from "react";
import { inputClass, secondaryButton } from "@/components/ui";
import { suggestWords, themeFor, themeLists } from "@/lib/theme-words";

// The theme, grid and words for a word search (owner, 9 November 2026): type
// a theme and "Suggest words" fills the word box from FootprintOS's ready-made
// lists, keeping any words already typed; staff then trim or add their own.
export default function WordSearchWords({ rows = 5 }: { rows?: number }) {
  const [theme, setTheme] = useState("");
  const [grid, setGrid] = useState(12);
  const [words, setWords] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  const suggest = (label?: string) => {
    const list = label ? themeLists.find((l) => l.label === label) ?? null : themeFor(theme);
    if (!list) {
      setNote(`No ready-made words for “${theme.trim() || "that"}”. Pick a theme below, or type your own words.`);
      setMissing(true);
      return;
    }
    if (label) setTheme(label);
    const typed = words.split(/[\n,;]+/).map((w) => w.trim()).filter(Boolean);
    const seen = new Set(typed.map((w) => w.toLowerCase()));
    const added = suggestWords(list, grid).filter((w) => !seen.has(w.toLowerCase()));
    setWords([...typed, ...added].join("\n"));
    setNote(`Added ${added.length} ${list.label} words. Delete any you don't want and add your own.`);
    setMissing(false);
  };

  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        <input
          name="theme"
          maxLength={80}
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          list="word-search-themes"
          placeholder="Theme, e.g. Christmas"
          aria-label="Theme"
          className={inputClass}
        />
        <button type="button" onClick={() => suggest()} disabled={!theme.trim()} className={`${secondaryButton} shrink-0 px-2 text-xs disabled:opacity-50`}>
          Suggest words
        </button>
      </div>
      <datalist id="word-search-themes">
        {themeLists.map((l) => (
          <option key={l.label} value={l.label} />
        ))}
      </datalist>
      {note && <p className="text-xs text-fp-dark/75">{note}</p>}
      {missing && (
        <div className="flex flex-wrap gap-1">
          {themeLists.map((l) => (
            <button key={l.label} type="button" onClick={() => suggest(l.label)} className="rounded-full border border-fp-border bg-white px-2 py-0.5 text-[11px] hover:bg-fp-light">
              {l.label}
            </button>
          ))}
        </div>
      )}
      <label className="grid gap-1">
        <span className="text-xs text-fp-mid">Word search only: the words to hide, one per line or separated by commas</span>
        <textarea name="words" rows={rows} value={words} onChange={(e) => setWords(e.target.value)} placeholder={"Robin\nBlue tit\nSparrow…"} aria-label="Words to hide" className={inputClass} />
      </label>
      <select name="grid" value={grid} onChange={(e) => setGrid(Number(e.target.value))} aria-label="Word search grid" className={inputClass}>
        {[10, 12, 15].map((n) => (
          <option key={n} value={n}>
            Word search grid {n} × {n}
          </option>
        ))}
      </select>
    </div>
  );
}
