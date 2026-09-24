import type { Schemas } from '@/api/client'
import { useRuns } from '@/api/hooks/runs'
import { ErrorsPopover } from '@/components/ErrorsPopover'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { t } from '@/lib/i18n'
import { parseApiDate, relativeFromNow } from '@/lib/time'

type Run = Schemas['RunResponse']

const MAX_SHOWN = 10

function Status({ run }: { run: Run }) {
  if (run.current_phase) return <Badge>{t(`runStatus.phase.${run.current_phase}`)}</Badge>
  if (run.cancelled) return <span className="text-xs text-muted-foreground">{t('scans.stopped')}</span>
  return <span className="text-xs text-muted-foreground">{t('scans.done')}</span>
}

// Cronologia delle scansioni (le "run" della pipeline): in dashboard accanto
// alle novità, perché racconta lo stesso: cosa è successo e quando.
export function ScanHistoryCard({ className }: { className?: string }) {
  const { data: runs, isPending } = useRuns()
  const shown = runs?.slice(0, MAX_SHOWN)

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{t('scans.title')}</CardTitle>
        <CardDescription>{t('scans.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('scans.started')}</TableHead>
              <TableHead>{t('scans.status')}</TableHead>
              <TableHead className="text-right">{t('scans.files')}</TableHead>
              <TableHead className="text-right">{t('scans.matches')}</TableHead>
              <TableHead className="text-right">{t('scans.errors')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  {t('common.loading')}
                </TableCell>
              </TableRow>
            )}
            {shown?.map((run) => (
              <TableRow key={run.id}>
                <TableCell title={parseApiDate(run.started_at).toLocaleString()}>
                  <span className="text-sm">{relativeFromNow(run.started_at)}</span>
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    {t(`scans.type.${run.run_type}`)}
                  </span>
                </TableCell>
                <TableCell>
                  <Status run={run} />
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">{run.items_scanned}</TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">{run.matches_found}</TableCell>
                <TableCell className="text-right">
                  <ErrorsPopover count={run.errors} messages={run.error_messages} />
                </TableCell>
              </TableRow>
            ))}
            {runs?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  {t('reseeding.noRunsYet')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
