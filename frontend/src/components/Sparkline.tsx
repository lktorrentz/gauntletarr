import { t } from '@/lib/i18n'

/** Sparkline SVG minimale, senza dipendenze — sufficiente per lo storico
 * della salute libreria (docs/SPEC.md §10), non serve una libreria di
 * grafici completa per un solo indicatore. */
export function Sparkline({ points, max = 100 }: { points: number[]; max?: number }) {
  if (points.length < 2) {
    return <p className="text-xs text-muted-foreground">{t('dashboard.notEnoughHistory')}</p>
  }
  const width = 240
  const height = 48
  const step = width / (points.length - 1)
  const coords = points.map((p, i) => `${i * step},${height - (Math.min(p, max) / max) * height}`).join(' ')

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="text-primary">
      <polyline points={coords} fill="none" stroke="currentColor" strokeWidth={2} />
    </svg>
  )
}
