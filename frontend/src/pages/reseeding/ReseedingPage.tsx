import { ChevronRightIcon, PlayIcon, RotateCcwIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { useRuns, useTriggerRun } from '@/api/hooks/runs'
import {
  useApproveReview,
  useCandidateAudit,
  useFailedSeedJobs,
  useRejectReview,
  useRetryFailed,
  useReviews,
} from '@/api/hooks/reviews'
import { useSchedule, useSetSchedule } from '@/api/hooks/schedule'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

function CandidateAudit({ mediaItemId }: { mediaItemId: number }) {
  const { data, isPending } = useCandidateAudit(mediaItemId)

  if (isPending) return <p className="p-3 text-xs text-muted-foreground">Caricamento candidati…</p>

  return (
    <div className="grid gap-1.5 border-t bg-muted/30 p-3">
      <p className="text-xs font-medium text-muted-foreground">
        Tutti i candidati valutati per questo contenuto:
      </p>
      {data?.map((c) => (
        <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
          <span className="truncate font-mono">{c.name}</span>
          <div className="flex shrink-0 items-center gap-2">
            {c.ambiguity_reason && <span className="text-muted-foreground">{c.ambiguity_reason}</span>}
            <span>{(c.confidence * 100).toFixed(0)}%</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function ReviewRow({ review }: { review: NonNullable<ReturnType<typeof useReviews>['data']>[number] }) {
  const [open, setOpen] = useState(false)
  const approve = useApproveReview()
  const reject = useRejectReview()

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b last:border-b-0">
      <div className="flex items-center gap-2 px-3 py-2">
        <CollapsibleTrigger>
          <ChevronRightIcon className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-90')} />
        </CollapsibleTrigger>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{review.candidate_name}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{review.direction}</Badge>
            <span>{(review.confidence * 100).toFixed(0)}%</span>
            {review.ambiguity_reason && <span>{review.ambiguity_reason}</span>}
            {review.status === 'auto_approved' && <Badge>auto-approvato</Badge>}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            approve.mutate(review.id, { onError: (error) => toast.error(`Approvazione fallita: ${error.message}`) })
          }
        >
          Approva
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            reject.mutate(review.id, { onError: (error) => toast.error(`Rifiuto fallito: ${error.message}`) })
          }
        >
          Rifiuta
        </Button>
      </div>
      <CollapsibleContent>
        <CandidateAudit mediaItemId={review.media_item_id} />
      </CollapsibleContent>
    </Collapsible>
  )
}

function ReviewCard() {
  const { data: reviews, isPending } = useReviews()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isPending && <p className="p-3 text-sm text-muted-foreground">Caricamento…</p>}
        {reviews?.map((r) => (
          <ReviewRow key={r.id} review={r} />
        ))}
        {reviews?.length === 0 && <p className="p-3 text-sm text-muted-foreground">Nessuna review in attesa.</p>}
      </CardContent>
    </Card>
  )
}

function RunsCard() {
  const { data: runs, isPending } = useRuns()
  const triggerRun = useTriggerRun()

  return (
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
  )
}

function FailedJobRow({ job }: { job: NonNullable<ReturnType<typeof useFailedSeedJobs>['data']>[number] }) {
  const [open, setOpen] = useState(false)
  const retry = useRetryFailed()

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b last:border-b-0">
      <div className="flex items-center gap-2 px-3 py-2">
        <CollapsibleTrigger>
          <ChevronRightIcon className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-90')} />
        </CollapsibleTrigger>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Candidate #{job.candidate_id}</p>
          <p className="truncate text-xs text-destructive">{job.error_message}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            retry.mutate(job.id, {
              onSuccess: () => toast.success('Retry completato.'),
              onError: (error) => toast.error(`Retry fallito: ${error.message}`),
            })
          }
        >
          <RotateCcwIcon className="size-4" />
          Retry
        </Button>
      </div>
      <CollapsibleContent>
        <div className="grid gap-1 border-t bg-muted/30 p-3 text-xs">
          <p>
            <span className="text-muted-foreground">Recheck: </span>
            {job.recheck_status ?? '—'}
          </p>
          <p className="whitespace-pre-wrap font-mono text-destructive">{job.error_message}</p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// Non esiste un run_id sui seed job (nessuna FK verso RunResponse nello schema
// backend) — impossibile filtrare le esecuzioni fallite per una specifica run
// cliccata. Ogni riga qui sotto è invece espandibile singolarmente per il suo
// dettaglio completo, il modo più diretto per vedere un fallimento senza
// modificare lo schema.
function FailedJobsCard() {
  const { data, isPending } = useFailedSeedJobs()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Esecuzioni fallite</CardTitle>
        <CardDescription>Clicca una riga per il dettaglio completo dell'errore.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {isPending && <p className="p-3 text-sm text-muted-foreground">Caricamento…</p>}
        {data?.map((job) => (
          <FailedJobRow key={job.id} job={job} />
        ))}
        {data?.length === 0 && <p className="p-3 text-sm text-muted-foreground">Nessuna esecuzione fallita.</p>}
      </CardContent>
    </Card>
  )
}

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

export function ReseedingPage() {
  return (
    <div className="grid gap-6">
      <ReviewCard />
      <RunsCard />
      <FailedJobsCard />
      <ScheduleCard />
    </div>
  )
}
