// Colori degli stati, uguali in tutta l'interfaccia (badge, pallini, card):
// verde seeding, rosso orfano, viola duplicato, ambra in attesa di
// approvazione, azzurro ignorato (in seed ma non in libreria), grigio
// escluso/non identificato. Unica fonte: nessun componente sceglie da sé.
export type StatusKey = 'seeding' | 'orphan' | 'duplicate' | 'review' | 'ignored' | 'excluded' | 'unmatched' | 'failed'

export const STATUS_STYLES: Record<StatusKey, { dot: string; badge: string; gradient: string }> = {
  seeding: {
    dot: 'bg-emerald-500', gradient: 'from-emerald-500/10',
    badge: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  },
  orphan: { dot: 'bg-red-500', gradient: 'from-red-500/10', badge: 'border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-300' },
  duplicate: {
    dot: 'bg-violet-500', gradient: 'from-violet-500/10',
    badge: 'border-violet-500/40 bg-violet-500/15 text-violet-700 dark:text-violet-300',
  },
  review: { dot: 'bg-amber-500', gradient: 'from-amber-500/10', badge: 'border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  ignored: { dot: 'bg-sky-500', gradient: 'from-sky-500/10', badge: 'border-sky-500/40 bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  excluded: { dot: 'bg-zinc-400', gradient: 'from-zinc-400/10', badge: 'border-zinc-400/40 bg-zinc-400/15 text-zinc-600 dark:text-zinc-300' },
  unmatched: { dot: 'bg-zinc-400', gradient: 'from-zinc-400/10', badge: 'border-zinc-400/40 bg-zinc-400/15 text-zinc-600 dark:text-zinc-300' },
  failed: { dot: 'bg-red-500', gradient: 'from-red-500/10', badge: 'border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-300' },
}

// Stati del backend (app/library.py, seed job) -> stile.
export function statusKeyOf(state: string): StatusKey | null {
  switch (state) {
    case 'seeding':
      return 'seeding'
    case 'orphan_media':
    case 'orphan_torrent':
      return 'orphan'
    case 'ignored':
      return 'ignored'
    case 'unmatched':
      return 'unmatched'
    case 'failed':
      return 'failed'
    default:
      return null
  }
}

// Card riassuntive (vista folder e poster): stesso gradiente delle card
// della Dashboard (bg-gradient-to-t … to-card), nel colore dello stato.
export function summaryStyle(value: string): { dot: string; gradient: string } {
  if (value === 'all') return { dot: 'bg-foreground', gradient: 'from-primary/5' }
  if (value === 'duplicates') return STATUS_STYLES.duplicate
  if (value === 'review') return STATUS_STYLES.review
  const key = statusKeyOf(value)
  return key ? STATUS_STYLES[key] : { dot: 'bg-muted-foreground', gradient: 'from-muted/40' }
}

