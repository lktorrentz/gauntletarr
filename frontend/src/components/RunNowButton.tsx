import { PlayIcon } from 'lucide-react'
import { toast } from 'sonner'

import { useTriggerRun } from '@/api/hooks/runs'
import { Button } from '@/components/ui/button'
import { t } from '@/lib/i18n'

// Stesso trigger di ReseedingPage (POST /api/runs) — vive nel TopHeader
// (globale, ogni pagina) invece che solo sulla Dashboard: lanciare uno
// scan richiedeva di sapere che "Reseeding" è anche la pagina delle run,
// tutt'altro che intuitivo (richiesta esplicita dell'utente).
export function RunNowButton() {
  const triggerRun = useTriggerRun()
  return (
    <Button
      size="sm"
      onClick={() =>
        triggerRun.mutate(undefined, {
          onError: (error) => toast.error(t('common.runFailed', { message: error.message })),
        })
      }
      disabled={triggerRun.isPending}
    >
      <PlayIcon className="size-4" />
      {t('common.runNow')}
    </Button>
  )
}
