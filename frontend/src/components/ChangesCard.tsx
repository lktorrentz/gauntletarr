import { useState } from 'react'

import type { Schemas } from '@/api/client'
import { useDashboardChanges } from '@/api/hooks/dashboard'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { t } from '@/lib/i18n'
import { formatBytes } from '@/lib/library-filters'
import { CHANGE_STYLES } from '@/lib/status-styles'
import { parseApiDate } from '@/lib/time'
import { cn } from '@/lib/utils'
import { ItemDetailSheet, type OpenItem } from '@/pages/library/ItemDetailSheet'

type Change = Schemas['FileChangeItem']

// Ordine dei filtri: prima cosa è comparso o sparito su disco, poi i cambi di stato.
const KIND_ORDER = [
  'new_torrent', 'new_media', 'removed_torrent', 'removed_media',
  'now_seeding', 'now_orphaned', 'now_ignored', 'stopped', 'resumed', 'state_changed',
]

const styleOf = (kind: string) => CHANGE_STYLES[kind] ?? CHANGE_STYLES.state_changed

function KindBadge({ kind }: { kind: string }) {
  return (
    <Badge variant="outline" className={cn('h-auto gap-1.5 py-0 font-mono text-[length:var(--text-xxs)] leading-4', styleOf(kind).badge)}>
      <span className={cn('size-1.5 rounded-full', styleOf(kind).dot)} />
      {t(`changes.kind.${kind}`)}
    </Badge>
  )
}

function formatWhen(value: string | null | undefined) {
  if (!value) return '—'
  return parseApiDate(value).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// Cosa è cambiato su disco e nei client fra l'ultima scansione e quella
// prima, file per file (app/file_changes.py) — ispirato alla vista
// "Changes since last scan" di Auditorr.
export function ChangesCard({ className }: { className?: string }) {
  const { data, isPending } = useDashboardChanges()
  const [kind, setKind] = useState<string>('all')
  const [openItem, setOpenItem] = useState<OpenItem | null>(null)
  const kinds = KIND_ORDER.filter((k) => (data?.counts[k] ?? 0) > 0)
  const shown = (data?.changes ?? []).filter((c: Change) => kind === 'all' || c.kind === kind)
  const delta = data?.health_delta

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{t('changes.title')}</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-2 font-mono text-xs">
          {data?.since && (
            <span>
              {formatWhen(data.since)} – {formatWhen(data.until)}
            </span>
          )}
          {delta != null && (
            <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5">
              <span className={cn('size-1.5 rounded-full', delta >= 0 ? 'bg-emerald-500' : 'bg-red-500')} />
              {t('changes.healthDelta', { delta: `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}` })}
            </span>
          )}
          {data && !data.baseline_only && data.since && <span>{t('changes.count', { count: data.total })}</span>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {kinds.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {['all', ...kinds].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:bg-muted',
                  kind === k && 'border-primary text-primary',
                )}
              >
                {k !== 'all' && <span className={cn('size-1.5 rounded-full', styleOf(k).dot)} />}
                {k === 'all' ? t('changes.all') : t(`changes.kind.${k}`)}
                <span className="font-mono text-muted-foreground tabular-nums">
                  {k === 'all' ? data?.total : data?.counts[k]}
                </span>
              </button>
            ))}
          </div>
        )}
        {isPending ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : !data?.since ? (
          <p className="text-sm text-muted-foreground">
            {data?.baseline_only ? t('changes.baselineOnly') : t('changes.noScanYet')}
          </p>
        ) : data.total === 0 ? (
          <p className="text-sm text-muted-foreground">{t('changes.nothingChanged')}</p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-0">{t('changes.type')}</TableHead>
                  <TableHead>{t('changes.path')}</TableHead>
                  <TableHead className="text-right">{t('changes.size')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((c, i) => {
                  const openable = c.content_type != null && c.tmdb_id != null
                  return (
                    <TableRow
                      key={`${c.side}:${c.disk_id}:${c.relative_path}:${i}`}
                      className={cn(openable && 'cursor-pointer')}
                      onClick={openable ? () => setOpenItem({ contentType: c.content_type!, tmdbId: c.tmdb_id! }) : undefined}
                    >
                      <TableCell>
                        <KindBadge kind={c.kind} />
                      </TableCell>
                      <TableCell className="max-w-0">
                        <span className="block truncate font-mono text-xs" title={c.relative_path}>
                          {c.relative_path}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs whitespace-nowrap tabular-nums">
                        {formatBytes(c.size_bytes)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            {data.total > data.changes.length && (
              <p className="pt-2 text-xs text-muted-foreground">
                {t('changes.truncated', { shown: data.changes.length, total: data.total })}
              </p>
            )}
          </div>
        )}
      </CardContent>
      <ItemDetailSheet item={openItem} onClose={() => setOpenItem(null)} />
    </Card>
  )
}
