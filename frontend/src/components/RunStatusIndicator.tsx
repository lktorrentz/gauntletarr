import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  CircleDashedIcon,
  CircleIcon,
  Loader2Icon,
  XIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { useRuns } from '@/api/hooks/runs'
import { Progress } from '@/components/ui/progress'
import { t } from '@/lib/i18n'
import {
  etaSeconds,
  formatCount,
  formatDuration,
  percent,
  runSteps,
  type RunResponse,
  type Step,
} from '@/lib/run-progress'
import { cn } from '@/lib/utils'

const FLASH_DURATION_MS = 12_000
const FLASH_DURATION_WITH_ERRORS_MS = 30_000
const EXPANDED_STORAGE_KEY = 'runStatus.expanded'

function readExpanded(): boolean {
  try {
    return localStorage.getItem(EXPANDED_STORAGE_KEY) !== 'false'
  } catch {
    return true
  }
}

function writeExpanded(value: boolean) {
  try {
    localStorage.setItem(EXPANDED_STORAGE_KEY, String(value))
  } catch {
    // preferenza solo di comodità: senza storage resta com'è in questa sessione
  }
}

// Ridisegna ogni secondo mentre la run è attiva: tempo trascorso e stima
// cambiano anche tra un poll e l'altro (ogni 3s, useRuns).
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active])
  return now
}

function stepSummary(step: Step): string | null {
  const p = step.progress
  if (!p) return null
  const count = t(`runStatus.unit.${step.phase}`, { count: formatCount(p.done) })
  return p.skipped ? `${count} · ${t('runStatus.skipped', { count: formatCount(p.skipped) })}` : count
}

function StepIcon({ state }: { state: Step['state'] }) {
  if (state === 'done') return <CheckCircle2Icon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
  if (state === 'running') return <Loader2Icon className="size-3.5 animate-spin text-primary" />
  if (state === 'skipped') return <CircleDashedIcon className="size-3.5 text-muted-foreground/60" />
  return <CircleIcon className="size-3.5 text-muted-foreground/40" />
}

function CurrentPhase({ run, step, now }: { run: RunResponse; step: Step; now: number }) {
  const p = step.progress
  const pct = percent(p?.done, p?.total)
  const eta = etaSeconds(p, now)
  return (
    <div className="grid gap-1 pl-5">
      {run.phase_detail && <p className="truncate text-xs text-muted-foreground">{run.phase_detail}</p>}
      {p && p.total != null && p.total > 0 ? (
        <>
          <Progress value={pct ?? 0} />
          <div className="flex items-center justify-between text-xs tabular-nums text-muted-foreground">
            <span>
              {formatCount(p.done)} / {formatCount(p.total)} · {pct}%
            </span>
            {eta != null && eta > 0 && <span>{t('runStatus.eta', { time: formatDuration(eta) })}</span>}
          </div>
          {p.skipped > 0 && (
            <p className="text-xs text-muted-foreground">
              {t('runStatus.skippedRecently', { count: formatCount(p.skipped) })}
            </p>
          )}
        </>
      ) : (
        <Progress value={null} />
      )}
    </div>
  )
}

function Stepper({ run, now }: { run: RunResponse; now: number }) {
  return (
    <ol className="grid gap-1.5">
      {runSteps(run).map((step) => (
        <li key={step.phase} className="grid gap-1">
          <div className="flex items-center gap-2 text-xs">
            <StepIcon state={step.state} />
            <span
              className={cn(
                'flex-1',
                step.state === 'running' && 'font-medium',
                (step.state === 'pending' || step.state === 'skipped') && 'text-muted-foreground',
              )}
            >
              {t(`runStatus.phase.${step.phase}`)}
            </span>
            {step.state === 'done' && (
              <span className="text-muted-foreground tabular-nums">{stepSummary(step)}</span>
            )}
          </div>
          {step.state === 'running' && <CurrentPhase run={run} step={step} now={now} />}
        </li>
      ))}
    </ol>
  )
}

function compactLine(run: RunResponse, active: boolean): string {
  if (!active) return t('runStatus.summary', { scanned: formatCount(run.items_scanned), errors: run.errors })
  const phase = run.current_phase ? t(`runStatus.phase.${run.current_phase}`) : t('runStatus.starting')
  const pct = percent(run.phase_done, run.phase_total)
  if (run.phase_total == null || run.phase_total <= 0 || pct == null) return phase
  return `${phase} · ${formatCount(run.phase_done ?? 0)}/${formatCount(run.phase_total)} · ${pct}%`
}

// Vive nel layout globale (AppLayout), non in una singola pagina: sopravvive
// al cambio view mentre una run è in corso. wasActiveRef distingue "una run
// che stavamo seguendo è appena finita" (mostra il riepilogo) da "l'ultima
// run nello storico era già finita da prima che questo componente
// montasse" (niente). Avanzamento per fase da app/run_progress.py.
export function RunStatusIndicator() {
  const { data: runs } = useRuns()
  const latestRun = runs?.[0]
  const isActive = latestRun != null && latestRun.finished_at == null

  const [completedFlash, setCompletedFlash] = useState<RunResponse | null>(null)
  const [expanded, setExpanded] = useState(readExpanded)
  const wasActiveRef = useRef(false)
  const now = useNow(isActive)

  useEffect(() => {
    if (isActive) {
      wasActiveRef.current = true
      return
    }
    if (wasActiveRef.current && latestRun) {
      wasActiveRef.current = false
      setCompletedFlash(latestRun)
      const duration = latestRun.errors > 0 ? FLASH_DURATION_WITH_ERRORS_MS : FLASH_DURATION_MS
      const timer = setTimeout(() => setCompletedFlash(null), duration)
      return () => clearTimeout(timer)
    }
  }, [isActive, latestRun])

  const run = isActive ? latestRun : completedFlash
  if (!run) return null

  const hasErrors = !isActive && run.errors > 0
  const elapsedEnd = run.finished_at ? new Date(run.finished_at).getTime() : now
  const elapsed = (elapsedEnd - new Date(run.started_at).getTime()) / 1000
  const toggle = () => {
    setExpanded((value) => {
      writeExpanded(!value)
      return !value
    })
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-lg border bg-card text-sm shadow-lg">
      <div className="flex items-start gap-3 px-4 py-3">
        {isActive ? (
          <Loader2Icon className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
        ) : hasErrors ? (
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
        ) : (
          <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center justify-between gap-2 font-medium">
            <span className="truncate">
              {isActive
                ? t('runStatus.inProgress', { id: run.id })
                : hasErrors
                  ? t('runStatus.completedWithErrors')
                  : t('runStatus.completed')}
            </span>
            <span className="shrink-0 text-xs font-normal text-muted-foreground tabular-nums">
              {formatDuration(elapsed)}
            </span>
          </p>
          {!expanded && <p className="truncate text-xs text-muted-foreground">{compactLine(run, isActive)}</p>}
        </div>
        <button
          type="button"
          onClick={toggle}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label={expanded ? t('runStatus.collapse') : t('runStatus.expand')}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronDownIcon className="size-4" /> : <ChevronUpIcon className="size-4" />}
        </button>
        {!isActive && (
          <button
            type="button"
            onClick={() => setCompletedFlash(null)}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={t('runStatus.dismiss')}
          >
            <XIcon className="size-4" />
          </button>
        )}
      </div>

      {expanded && (
        <div className="grid gap-3 border-t px-4 py-3">
          <Stepper run={run} now={now} />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2 text-xs text-muted-foreground tabular-nums">
            <span>{t('runStatus.candidates', { count: formatCount(run.matches_found) })}</span>
            <span>{t('runStatus.executed', { count: formatCount(run.auto_executed) })}</span>
            <span className={cn(run.errors > 0 && 'text-destructive')}>
              {t('runStatus.errors', { count: run.errors })}
            </span>
          </div>
          {hasErrors && run.last_error && <p className="text-xs text-destructive">{run.last_error}</p>}
          {!isActive && run.pending_review > 0 && (
            <Link to="/reseeding" className="text-xs font-medium text-primary hover:underline">
              {t('runStatus.reviewPending', { count: run.pending_review })}
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
