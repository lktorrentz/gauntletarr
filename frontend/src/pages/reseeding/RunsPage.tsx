import { PlayIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { useRuns, useTriggerRun } from '@/api/hooks/runs'
import { useSchedule, useSetSchedule } from '@/api/hooks/schedule'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

function ScheduleCard() {
  const { data: schedule } = useSchedule()
  const setSchedule = useSetSchedule()
  const [draft, setDraft] = useState<string | null>(null)
  const cron = draft ?? schedule?.cron ?? ''

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule</CardTitle>
        <CardDescription>
          Espressione cron standard a 5 campi (es. <code>0 */6 * * *</code> ogni 6 ore). Vuoto = nessuna run
          automatica.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-2">
        <Input value={cron} placeholder="0 */6 * * *" onChange={(e) => setDraft(e.target.value)} className="max-w-xs" />
        <Button
          variant="outline"
          onClick={() =>
            setSchedule.mutate(cron || null, {
              onSuccess: () => {
                toast.success(cron ? 'Schedule impostato.' : 'Schedule disabilitato.')
                setDraft(null)
              },
              onError: (error) => toast.error(`Salvataggio fallito: ${error.message}`),
            })
          }
        >
          Salva
        </Button>
        <Badge variant={schedule?.enabled ? 'default' : 'secondary'}>
          {schedule?.enabled ? 'attivo' : 'disattivo'}
        </Badge>
      </CardContent>
    </Card>
  )
}

export function RunsPage() {
  const { data: runs, isPending } = useRuns()
  const triggerRun = useTriggerRun()

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Runs</CardTitle>
          <Button
            onClick={() =>
              triggerRun.mutate(undefined, {
                onError: (error) => toast.error(`Avvio fallito: ${error.message}`),
              })
            }
            disabled={triggerRun.isPending}
          >
            <PlayIcon className="size-4" />
            Esegui ora
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Iniziata</TableHead>
                <TableHead>Fase</TableHead>
                <TableHead>Scansionati</TableHead>
                <TableHead>Errori</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    Caricamento…
                  </TableCell>
                </TableRow>
              )}
              {runs?.map((run) => (
                <TableRow key={run.id}>
                  <TableCell>{run.run_type}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(run.started_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {run.current_phase ? (
                      <Badge>{run.current_phase}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">terminata</span>
                    )}
                  </TableCell>
                  <TableCell>{run.items_scanned}</TableCell>
                  <TableCell>{run.errors > 0 ? <Badge variant="destructive">{run.errors}</Badge> : 0}</TableCell>
                </TableRow>
              ))}
              {runs?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    Nessuna run ancora eseguita.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ScheduleCard />
    </div>
  )
}
