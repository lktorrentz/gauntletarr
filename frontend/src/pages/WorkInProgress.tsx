import { ConstructionIcon } from 'lucide-react'

import { t } from '@/lib/i18n'

// Sezione non ancora pronta per chi prova l'app: il codice resta nel repo
// (pages/upload), ma la route mostra solo questo finché non è rifinita.
export function WorkInProgress({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-2 text-center">
      <ConstructionIcon className="size-10 text-muted-foreground" />
      <p className="text-lg font-medium">{title}</p>
      <span className="rounded-full border px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
        {t('common.workInProgress')}
      </span>
      <p className="max-w-md text-sm text-muted-foreground">{description ?? t('common.workInProgressHint')}</p>
    </div>
  )
}
