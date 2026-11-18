// Magazine puzzles (owner, 9 November 2026): word searches and sudoku made by
// FootprintOS for pages not sold as adverts, with the answers printed on
// another page of the same issue. Each puzzle is made once from a random
// "seed" and saved, so the puzzle and its answers always match.
// Kept apart from the database so it can be checked on its own.

export type PuzzleKind = "wordsearch" | "sudoku";
export type Difficulty = "easy" | "medium" | "hard";

export const puzzleKinds: { value: PuzzleKind; label: string }[] = [
  { value: "wordsearch", label: "Word search" },
  { value: "sudoku", label: "Sudoku" },
];
export const difficulties: { value: Difficulty; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];
export const isPuzzleKind = (v: unknown): v is PuzzleKind => v === "wordsearch" || v === "sudoku";
export const isDifficulty = (v: unknown): v is Difficulty => v === "easy" || v === "medium" || v === "hard";

// A small, repeatable random number maker (the same seed gives the same puzzle).
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], rand: () => number) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Word search ────────────────────────────────────────────────────────────

export type Placement = { word: string; row: number; col: number; dr: number; dc: number };
export type WordSearch = { kind: "wordsearch"; size: number; grid: string[]; words: string[]; placements: Placement[] };

// Easy: across and down. Medium: also diagonally. Hard: also backwards.
const DIRECTIONS: Record<Difficulty, [number, number][]> = {
  easy: [[0, 1], [1, 0]],
  medium: [[0, 1], [1, 0], [1, 1], [-1, 1]],
  hard: [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]],
};

// Letters that mustn't spell out something rude in a family magazine. The
// random filler is redrawn if it makes any of these in any direction (the
// chosen words themselves are fine: Titchfield, Sussex, peacock…).
const BLOCKED = ["ARSE", "BUM", "COCK", "CRAP", "CUNT", "DICK", "FAG", "FART", "FUCK", "NOB", "PISS", "POO", "PORN", "PRICK", "SEX", "SHAG", "SHIT", "SLAG", "SLUT", "TIT", "TWAT", "WANK"];

// Clean a list of words typed by staff: letters only, upper case, no repeats.
// Spaces are dropped in the grid ("GARDEN BIRD" is hidden as GARDENBIRD).
export function cleanWords(text: string) {
  const seen = new Set<string>();
  const words: string[] = [];
  for (const raw of text.split(/[\n,;]+/)) {
    const word = raw.toUpperCase().replace(/[^A-Z]/g, "");
    if (word.length >= 3 && !seen.has(word)) {
      seen.add(word);
      words.push(word);
    }
  }
  return words;
}

const lineAt = (grid: string[][], r: number, c: number, dr: number, dc: number, len: number) => {
  let s = "";
  for (let i = 0; i < len; i++) {
    const row = grid[r + dr * i];
    const ch = row?.[c + dc * i];
    if (ch === undefined) return null;
    s += ch;
  }
  return s;
};

// How many times a word can be read in the grid, in any of the 8 directions.
export function countWord(grid: string[][], word: string) {
  let n = 0;
  for (let r = 0; r < grid.length; r++)
    for (let c = 0; c < grid.length; c++)
      for (const [dr, dc] of DIRECTIONS.hard) if (lineAt(grid, r, c, dr, dc, word.length) === word) n++;
  // A palindrome reads the same both ways, so it's found twice at one spot.
  return word === [...word].reverse().join("") ? n / 2 : n;
}

export function makeWordSearch(words: string[], size: number, difficulty: Difficulty, seed: number): { ok: true; puzzle: WordSearch } | { ok: false; error: string } {
  if (size < 8 || size > 20) return { ok: false, error: "The grid must be 8 to 20 squares across" };
  if (words.length < 3) return { ok: false, error: "Give at least 3 words of 3 or more letters" };
  if (words.length > 30) return { ok: false, error: "Give no more than 30 words" };
  const tooLong = words.filter((w) => w.length > size);
  if (tooLong.length) return { ok: false, error: `Too long for a ${size} × ${size} grid: ${tooLong.join(", ")}` };

  const rand = seededRandom(seed);
  const dirs = DIRECTIONS[difficulty];
  // How often a rude word may appear: only inside the chosen words themselves.
  const occurs = (w: string, b: string) => w.split(b).length - 1;
  const allowed = (b: string) =>
    words.reduce((n, w) => n + occurs(w, b) + (b === [...b].reverse().join("") ? 0 : occurs([...w].reverse().join(""), b)), 0);
  const order = [...words].sort((a, b) => b.length - a.length);

  // A few tries at the whole grid; each word gets many tries at a spot.
  for (let attempt = 0; attempt < 30; attempt++) {
    const grid: string[][] = Array.from({ length: size }, () => Array<string>(size).fill(""));
    const placements: Placement[] = [];
    let failed = false;
    for (const word of order) {
      let placed = false;
      for (let t = 0; t < 400 && !placed; t++) {
        const [dr, dc] = dirs[Math.floor(rand() * dirs.length)];
        const r = Math.floor(rand() * size);
        const c = Math.floor(rand() * size);
        const endR = r + dr * (word.length - 1);
        const endC = c + dc * (word.length - 1);
        if (endR < 0 || endR >= size || endC < 0 || endC >= size) continue;
        let fits = true;
        for (let i = 0; i < word.length && fits; i++) {
          const cell = grid[r + dr * i][c + dc * i];
          if (cell && cell !== word[i]) fits = false;
        }
        if (!fits) continue;
        for (let i = 0; i < word.length; i++) grid[r + dr * i][c + dc * i] = word[i];
        placements.push({ word, row: r, col: c, dr, dc });
        placed = true;
      }
      if (!placed) {
        failed = true;
        break;
      }
    }
    if (failed) continue;

    // Fill the gaps with random letters until nothing rude shows up (except
    // inside a chosen word) and no extra copies of the words (so each is found
    // where it was hidden).
    const letters = "AABCDEEEFGHIIKLMNOOPRSSTTUWY";
    const already = (w: string) => countWord(grid, w);
    if (BLOCKED.some((b) => already(b) > allowed(b))) continue;
    for (let fill = 0; fill < 60; fill++) {
      const full = grid.map((row) => row.map((ch) => ch || letters[Math.floor(rand() * letters.length)]));
      if (BLOCKED.some((b) => countWord(full, b) > allowed(b))) continue;
      if (words.some((w) => countWord(full, w) !== already(w))) continue;
      return {
        ok: true,
        puzzle: { kind: "wordsearch", size, grid: full.map((row) => row.join("")), words: [...words].sort(), placements },
      };
    }
  }
  return { ok: false, error: "Those words don't fit well in that grid. Try a bigger grid or fewer words." };
}

// ─── Sudoku ─────────────────────────────────────────────────────────────────

export type Sudoku = { kind: "sudoku"; difficulty: Difficulty; puzzle: number[]; solution: number[] };

// Numbers given at the start: more makes it easier.
const GIVENS: Record<Difficulty, number> = { easy: 40, medium: 32, hard: 27 };

const canPlace = (g: number[], i: number, n: number) => {
  const r = Math.floor(i / 9);
  const c = i % 9;
  for (let k = 0; k < 9; k++) if (g[r * 9 + k] === n || g[k * 9 + c] === n) return false;
  const br = r - (r % 3);
  const bc = c - (c % 3);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) if (g[(br + y) * 9 + bc + x] === n) return false;
  return true;
};

// Fill the grid (0 = empty), trying numbers in a random order.
function fillGrid(g: number[], rand: () => number): boolean {
  const i = g.indexOf(0);
  if (i === -1) return true;
  for (const n of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rand)) {
    if (canPlace(g, i, n)) {
      g[i] = n;
      if (fillGrid(g, rand)) return true;
      g[i] = 0;
    }
  }
  return false;
}

// How many ways the grid can be finished (stops counting at `limit`).
export function countSolutions(g: number[], limit = 2): number {
  let best = -1;
  let bestOptions: number[] = [];
  for (let i = 0; i < 81; i++) {
    if (g[i]) continue;
    const options = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => canPlace(g, i, n));
    if (options.length === 0) return 0;
    if (best === -1 || options.length < bestOptions.length) {
      best = i;
      bestOptions = options;
    }
  }
  if (best === -1) return 1;
  let total = 0;
  for (const n of bestOptions) {
    g[best] = n;
    total += countSolutions(g, limit - total);
    g[best] = 0;
    if (total >= limit) break;
  }
  return total;
}

export function makeSudoku(difficulty: Difficulty, seed: number): Sudoku {
  const rand = seededRandom(seed);
  const solution = Array<number>(81).fill(0);
  fillGrid(solution, rand);
  const puzzle = [...solution];
  let givens = 81;
  // Take numbers away one at a time, keeping only one possible answer.
  for (const i of shuffle(Array.from({ length: 81 }, (_, k) => k), rand)) {
    if (givens <= GIVENS[difficulty]) break;
    const keep = puzzle[i];
    puzzle[i] = 0;
    if (countSolutions([...puzzle]) !== 1) puzzle[i] = keep;
    else givens--;
  }
  return { kind: "sudoku", difficulty, puzzle, solution };
}

// A new random seed for a puzzle.
export const newSeed = () => Math.floor(Math.random() * 2 ** 31);
