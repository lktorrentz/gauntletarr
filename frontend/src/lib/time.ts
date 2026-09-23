// "3 days ago" / "in 5 days", arrotondato all'unità più grande sensata:
// per ultima/prossima ricerca sul tracker nella scheda di dettaglio.
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
]

const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

export function relativeFromNow(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return '—'
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000)
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit)
  }
  return formatter.format(0, 'minute')
}
