export type JobRoleRule = { match_text: string; role_id: string; priority: number };

// Same matching as the database's suggested_role(): the first rule whose text
// appears in the job title (ignoring capitals), lowest priority number first,
// then the longest text. Returns the rule's role id, or null.
export function ruleRole(jobTitle: string | null, rules: JobRoleRule[]): string | null {
  if (!jobTitle) return null;
  const title = jobTitle.toLowerCase();
  return (
    [...rules]
      .filter((r) => title.includes(r.match_text.trim().toLowerCase()))
      .sort((a, b) => a.priority - b.priority || b.match_text.length - a.match_text.length)[0]?.role_id ?? null
  );
}
