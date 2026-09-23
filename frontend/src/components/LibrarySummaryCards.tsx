import { Card, CardContent } from '@/components/ui/card'
import { formatBytes, type StateSummary, type StatusOption } from '@/lib/library-filters'
import { cn } from '@/lib/utils'

// Colore del pallino coerente con le varianti di StateBadge (seeding =
// primary, orfani = destructive, ignored = secondary).
const STATE_DOT: Record<string, string> = {
  all: 'bg-foreground',
  seeding: 'bg-primary',
  orphan_media: 'bg-destructive',
  orphan_torrent: 'bg-destructive',
  ignored: 'bg-muted-foreground',
}

export function LibrarySummaryCards({
  statusOptions,
  summary,
  activeStatus,
  onSelect,
}: {
  statusOptions: StatusOption[]
  summary: Record<string, StateSummary>
  activeStatus: string
  onSelect: (status: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {statusOptions.map((option) => {
        const s = summary[option.value] ?? { count: 0, size: 0 }
        return (
          <Card
            key={option.value}
            size="sm"
            className={cn(
              'cursor-pointer transition-colors hover:bg-muted/50',
              activeStatus === option.value && 'ring-2 ring-primary/40',
            )}
            onClick={() => onSelect(option.value)}
          >
            <CardContent className="grid gap-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={cn('size-2 rounded-full', STATE_DOT[option.value] ?? 'bg-muted-foreground')} />
                {option.label}
              </div>
              <div className="text-2xl font-semibold tabular-nums">{s.count}</div>
              <div className="text-xs text-muted-foreground tabular-nums">{formatBytes(s.size)}</div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
