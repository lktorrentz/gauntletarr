import { useState } from 'react'

import { useLogs } from '@/api/hooks/system'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const LEVELS = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'] as const

const LEVEL_COLOR: Record<string, string> = {
  DEBUG: 'text-muted-foreground',
  INFO: 'text-foreground',
  WARNING: 'text-amber-600 dark:text-amber-400',
  ERROR: 'text-destructive',
  CRITICAL: 'text-destructive',
}

export function LogsSection() {
  const [minLevel, setMinLevel] = useState<string>('INFO')
  const { data } = useLogs(minLevel)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{t('logs.title')}</CardTitle>
          <CardDescription>{t('logs.description')}</CardDescription>
        </div>
        <Select value={minLevel} onValueChange={setMinLevel}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEVELS.map((level) => (
              <SelectItem key={level} value={level}>
                {level}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {data && !data.available && <p className="text-sm text-muted-foreground">{t('logs.notAvailable')}</p>}
        {data?.available && data.entries.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('logs.noEntries')}</p>
        )}
        {data && data.entries.length > 0 && (
          <div className="grid max-h-[32rem] gap-0.5 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs">
            {data.entries.map((entry, index) => (
              <div key={index} className="flex gap-2 whitespace-pre-wrap">
                <span className="shrink-0 text-muted-foreground">{entry.timestamp}</span>
                <span className={cn('shrink-0 font-semibold', LEVEL_COLOR[entry.level])}>{entry.level}</span>
                <span className="shrink-0 text-muted-foreground">{entry.logger}</span>
                <span>{entry.message}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
