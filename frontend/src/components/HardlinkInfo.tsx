import { InfoIcon } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { t } from '@/lib/i18n'

// Hover sull'icona per vedere con quali altri path questo file condivide
// l'hardlink (relazione seed_file.media_file_id, già stabilita dal motore
// di matching — mai un nuovo scan degli inode solo per questo).
export function HardlinkInfo({ linkedPaths }: { linkedPaths: string[] }) {
  if (linkedPaths.length === 0) return null

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={t('library.hardlink')} />
        }
      >
        <InfoIcon className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-sm">
        <div className="grid gap-0.5">
          <span className="font-medium">
            {t('library.hardlink')} ({linkedPaths.length})
          </span>
          {linkedPaths.map((path) => (
            <span key={path} className="font-mono text-[11px] break-all opacity-90">
              {path}
            </span>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
