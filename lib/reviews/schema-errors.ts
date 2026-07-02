export function isMissingColumnError(
  message: string | undefined,
  column: string,
): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  const columnLower = column.toLowerCase();
  return (
    lower.includes(columnLower) &&
    (lower.includes("schema cache") ||
      lower.includes("could not find") ||
      lower.includes("does not exist"))
  );
}
