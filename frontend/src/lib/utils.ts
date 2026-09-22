export { cn } from "cn"

/**
 * Select.Value di Base UI mostra il `value` grezzo selezionato a meno di
 * non mappare esplicitamente valore -> etichetta (mai automatico come in
 * Radix, verificato leggendo i tipi del pacchetto) — e passare `children`
 * disattiva anche il fallback al `placeholder` quando nulla è ancora
 * selezionato, va quindi gestito qui. Un solo helper condiviso invece di
 * ripetere questa logica in ogni Select dell'app.
 */
export function selectLabel<T>(
  items: T[] | undefined,
  value: string | null,
  getValue: (item: T) => string,
  getLabel: (item: T) => string,
  placeholder: string,
): string {
  if (!value) return placeholder
  const found = items?.find((item) => getValue(item) === value)
  return found ? getLabel(found) : value
}
