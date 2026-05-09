/* Cycle 4 fix (A1): tiny plural helper to kill the lazy `(s)` literals
 * that were peppered across the equipe + admin surfaces.
 *
 * Usage:
 *   pluralize(count, "paciente", "pacientes")       -> "1 paciente" / "2 pacientes"
 *   pluralize(0, "evento", "eventos")               -> "0 eventos"
 *
 * Rules in pt-BR are not regular for every word (vez/vezes, lápis/lápis,
 * cidadão/cidadãos), so callers pass both forms explicitly. This is one
 * line at each call site and stops the "(s)" anti-pattern from spreading.
 *
 * Returns a string that already includes the count.
 */
export function pluralize(count, singular, plural) {
  const n = Number(count) || 0;
  return `${n} ${n === 1 ? singular : plural}`;
}

/* Variant that returns just the noun (no count prefix) — useful when the
 * count is rendered in a separate <strong> element. */
export function pluralWord(count, singular, plural) {
  return Number(count) === 1 ? singular : plural;
}
