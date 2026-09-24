// Colori degli stati, uguali in tutta l'interfaccia (badge, pallini, card):
// verde seeding, rosso orfano, viola duplicato, ambra in attesa di
// approvazione, azzurro ignorato (in seed ma non in libreria), grigio
// escluso/non identificato. Unica fonte: nessun componente sceglie da sé.
export type StatusKey = 'seeding' | 'orphan' | 'duplicate' | 'review' | 'ignored' | 'excluded' | 'unmatched' | 'failed'

export const STATUS_STYLES: Record<StatusKey, { dot: string; badge: string }> = {
  seeding: {
    dot: 'bg-emerald-500',
    badge: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  },
  orphan: { dot: 'bg-red-500', badge: 'border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-300' },
  duplicate: {
    dot: 'bg-violet-500',
    badge: 'border-violet-500/40 bg-violet-500/15 text-violet-700 dark:text-violet-300',
  },
  review: { dot: 'bg-amber-500', badge: 'border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  ignored: { dot: 'bg-sky-500', badge: 'border-sky-500/40 bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  excluded: { dot: 'bg-zinc-400', badge: 'border-zinc-400/40 bg-zinc-400/15 text-zinc-600 dark:text-zinc-300' },
  unmatched: { dot: 'bg-zinc-400', badge: 'border-zinc-400/40 bg-zinc-400/15 text-zinc-600 dark:text-zinc-300' },
  failed: { dot: 'bg-red-500', badge: 'border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-300' },
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
