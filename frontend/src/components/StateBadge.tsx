import { Badge } from '@/components/ui/badge'
import { STATUS_STYLES, statusKeyOf, type StatusKey } from '@/lib/status-styles'
import { cn } from '@/lib/utils'

// Stati unificati per file, docs/SPEC.md §3 — stessa terminologia di
// app/library.py; orphan_media e orphan_torrent sono entrambi "orphaned"
// per l'utente (il lato è già chiaro dalla vista). Colori da status-styles.
const STATE_LABELS: Record<string, string> = {
  seeding: 'seeding',
  orphan_media: 'orphaned',
  orphan_torrent: 'orphaned',
  ignored: 'ignored',
  unmatched: 'unmatched',
}

export function StatusBadge({ status, children }: { status: StatusKey; children: React.ReactNode }) {
  return (
    <Badge variant="outline" className={cn(STATUS_STYLES[status].badge)}>
      {children}
    </Badge>
  )
}

export function StateBadge({ state }: { state: string }) {
  const key = statusKeyOf(state)
  const label = STATE_LABELS[state] ?? state.replace(/_/g, ' ')
  if (key == null) return <Badge variant="outline">{label}</Badge>
  return <StatusBadge status={key}>{label}</StatusBadge>
}
