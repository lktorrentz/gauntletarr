import { useQueryClient } from '@tanstack/react-query'
import { AlertCircleIcon, CheckCircle2Icon, InfoIcon, Loader2Icon, XIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { useRecentSeedJobs } from '@/api/hooks/reviews'
import { dismissActivity, pushActivity, useActivities, type ActivityStatus } from '@/lib/activity'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const ICONS: Record<ActivityStatus, React.ReactNode> = {
  running: <Loader2Icon className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />,
  success: <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />,
  error: <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />,
  info: <InfoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />,
}

// Avvisa quando un recheck finisce in background (reconcile periodico dello
// scheduler, "Check now", una run): confronta lo stato delle ultime
// esecuzioni fra un poll e l'altro. Al primo caricamento non annuncia
// niente — solo i cambi avvenuti mentre l'app è aperta.
function useSeedJobWatcher() {
  const { data: jobs } = useRecentSeedJobs()
  const previous = useRef<Map<number, string> | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!jobs) return
    const before = previous.current
    previous.current = new Map(jobs.map((job) => [job.id, job.final_status]))
    if (before == null) return
    let changed = false
    for (const job of jobs) {
      if (before.get(job.id) !== 'in_progress' || job.final_status === 'in_progress') continue
      changed = true
      if (job.final_status === 'seeding') {
        pushActivity({ status: 'success', title: t('activity.nowSeeding'), detail: job.candidate_name ?? undefined })
      } else {
        pushActivity({
          status: 'error',
          title: t('activity.recheckFailed'),
          detail: job.error_message ?? job.candidate_name ?? undefined,
        })
      }
    }
    // Episodi e file passati a seeding: le viste della libreria si aggiornano.
    if (changed) queryClient.invalidateQueries({ queryKey: ['library'] })
  }, [jobs, queryClient])
}

export function ActivityStack() {
  const activities = useActivities()
  useSeedJobWatcher()
  if (activities.length === 0) return null
  return (
    <div className="grid w-80 max-w-[calc(100vw-2rem)] gap-2">
      {activities.map((activity) => (
        <div
          key={activity.id}
          role={activity.status === 'error' ? 'alert' : 'status'}
          className="flex items-start gap-3 rounded-lg border bg-card px-4 py-3 text-sm shadow-lg"
        >
          {ICONS[activity.status]}
          <div className="min-w-0 flex-1">
            <p className="font-medium">{activity.title}</p>
            {activity.detail && (
              <p className={cn('truncate text-xs', activity.status === 'error' ? 'text-destructive' : 'text-muted-foreground')}
                 title={activity.detail}>
                {activity.detail}
              </p>
            )}
          </div>
          {activity.status !== 'running' && (
            <button
              type="button"
              onClick={() => dismissActivity(activity.id)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label={t('runStatus.dismiss')}
            >
              <XIcon className="size-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
