/** Search normalization shared by every client-side search. */
export function normalizeSearch(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("id-ID")
    .trim()
    .replace(/\s+/g, " ");
}

export function matchesSearch(query: unknown, ...values: unknown[]): boolean {
  const q = normalizeSearch(query);
  return !q || values.some((value) => normalizeSearch(value).includes(q));
}
