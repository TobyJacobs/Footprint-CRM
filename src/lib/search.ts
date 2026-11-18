// Turns what someone typed into a forgiving "contains" pattern for searches:
// punctuation is ignored and the words can have anything between them, so
// "leaflets (1000" finds "A5 leaflets (1000)".
export function likePattern(input: string): string | null {
  const words = input
    .replace(/[%_,().*\\]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return words.length ? `%${words.join("%")}%` : null;
}
