import { AlertCircleIcon, CheckCircle2Icon, Loader2Icon, XIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type { Schemas } from '@/api/client'
import { useRuns } from '@/api/hooks/runs'
import { t } from '@/lib/i18n'

const FLASH_DURATION_MS = 5_000
const FLASH_DURATION_WITH_ERRORS_MS = 15_000

// Vive nel layout globale (AppLayout), non in una singola pagina: sopravvive
// al cambio view mentre una run è in corso — richiesta esplicita dopo che
// cliccare "Run now" non dava nessun feedback visibile che lo scan fosse
// partito. wasActiveRef distingue "una run che stavamo seguendo è appena
// finita" (mostra un flash di completamento) da "l'ultima run nello storico
// era già finita da prima che questo componente montasse" (nessun flash).
export function RunStatusIndicator() {
  const { data: runs } = useRuns()
  const latestRun = runs?.[0]
  const isActive = latestRun?.finished_at == null

  const [completedFlash, setCompletedFlash] = useState<Schemas['RunResponse'] | null>(null)
  const wasActiveRef = useRef(false)

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

  const visibleRun = isActive ? latestRun : completedFlash
  if (!visibleRun) return null

  const hasErrors = !isActive && visibleRun.errors > 0

  return (
    <div className="fixed right-4 bottom-4 z-50 flex items-start gap-3 rounded-lg border bg-card px-4 py-3 text-sm shadow-lg">
      {isActive ? (
        <Loader2Icon className="size-4 shrink-0 animate-spin text-primary" />
      ) : hasErrors ? (
        <AlertCircleIcon className="size-4 shrink-0 text-destructive" />
      ) : (
        <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      )}
      <div className="max-w-xs">
        <p className="font-medium">
          {isActive
            ? t('runStatus.inProgress')
            : hasErrors
              ? t('runStatus.completedWithErrors')
              : t('runStatus.completed')}
        </p>
        <p className="text-xs text-muted-foreground">
          {isActive && visibleRun.current_phase
            ? t('runStatus.phase', { phase: visibleRun.current_phase })
            : hasErrors && visibleRun.last_error
              ? visibleRun.last_error
              : t('runStatus.summary', { scanned: visibleRun.items_scanned, errors: visibleRun.errors })}
        </p>
      </div>
      {!isActive && (
        <button
          type="button"
          onClick={() => setCompletedFlash(null)}
          className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
          aria-label={t('runStatus.dismiss')}
        >
          <XIcon className="size-4" />
        </button>
      )}
    </div>
  )
}
