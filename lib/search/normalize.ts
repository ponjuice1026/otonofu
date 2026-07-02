export function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}

export function matchesSearchQuery(
  query: string,
  ...fields: (string | null | undefined)[]
): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;

  const activeFields = fields.filter(
    (field): field is string => Boolean(field?.trim()),
  );
  if (activeFields.length === 0) return false;

  const qLower = trimmed.toLowerCase();
  const qNorm = normalizeSearchText(trimmed);
  const tokens = trimmed.split(/\s+/).filter(Boolean);

  return activeFields.some((field) => {
    const fLower = field.toLowerCase();
    const fNorm = normalizeSearchText(field);

    if (fLower.includes(qLower) || fNorm.includes(qNorm)) {
      return true;
    }

    if (tokens.length > 1) {
      return tokens.every((token) => {
        const tokenLower = token.toLowerCase();
        const tokenNorm = normalizeSearchText(token);
        return (
          fLower.includes(tokenLower) ||
          fNorm.includes(tokenNorm) ||
          tokenNorm.includes(fNorm)
        );
      });
    }

    return false;
  });
}

export function searchMatchScore(
  query: string,
  ...fields: (string | null | undefined)[]
): number {
  if (!matchesSearchQuery(query, ...fields)) return 0;

  const trimmed = query.trim();
  const qLower = trimmed.toLowerCase();
  const qNorm = normalizeSearchText(trimmed);
  let score = 0;

  for (const field of fields) {
    if (!field) continue;
    const fLower = field.toLowerCase();
    const fNorm = normalizeSearchText(field);

    if (fLower === qLower || fNorm === qNorm) score = Math.max(score, 100);
    else if (fLower.startsWith(qLower) || fNorm.startsWith(qNorm)) {
      score = Math.max(score, 80);
    } else if (fLower.includes(qLower) || fNorm.includes(qNorm)) {
      score = Math.max(score, 60);
    }
  }

  return score;
}
