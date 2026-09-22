import { ChevronRightIcon, RotateCcwIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { useApproveReview, useCandidateAudit, useFailedSeedJobs, useRejectReview, useRetryFailed, useReviews } from '@/api/hooks/reviews'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

function CandidateAudit({ mediaItemId }: { mediaItemId: number }) {
  const { data, isPending } = useCandidateAudit(mediaItemId)

  if (isPending) return <p className="p-3 text-xs text-muted-foreground">Caricamento candidati…</p>

  return (
    <div className="grid gap-1.5 border-t bg-muted/30 p-3">
      <p className="text-xs font-medium text-muted-foreground">
        Tutti i candidati valutati per questo contenuto (audit, docs/SPEC.md §6):
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

function FailedJobsCard() {
  const { data, isPending } = useFailedSeedJobs()
  const retry = useRetryFailed()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Esecuzioni fallite</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Candidate</TableHead>
              <TableHead>Recheck</TableHead>
              <TableHead>Errore</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                  Caricamento…
                </TableCell>
              </TableRow>
            )}
            {data?.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="text-xs text-muted-foreground">#{job.candidate_id}</TableCell>
                <TableCell>{job.recheck_status ?? '—'}</TableCell>
                <TableCell className="max-w-sm truncate text-xs text-destructive" title={job.error_message ?? ''}>
                  {job.error_message}
                </TableCell>
                <TableCell>
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
                </TableCell>
              </TableRow>
            ))}
            {data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                  Nessuna esecuzione fallita.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function ReviewPage() {
  const { data: reviews, isPending } = useReviews()

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Review</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isPending && <p className="p-3 text-sm text-muted-foreground">Caricamento…</p>}
          {reviews?.map((r) => (
            <ReviewRow key={r.id} review={r} />
          ))}
          {reviews?.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">Nessuna review in attesa.</p>
          )}
        </CardContent>
      </Card>

      <FailedJobsCard />
    </div>
  )
}
