import { RefreshCwIcon } from 'lucide-react'

import { useAppInfo, useUpdateCheck } from '@/api/hooks/system'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'

function formatUptime(startedAt: string): string {
  const totalMinutes = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60_000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  const parts: string[] = []
  if (days) parts.push(`${days}d`)
  if (days || hours) parts.push(`${hours}h`)
  parts.push(`${minutes}m`)
  return parts.join(' ')
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b py-2 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  )
}

export function ApplicationSection() {
  const { data: info } = useAppInfo()
  const { data: updateCheck, isFetching, refetch } = useUpdateCheck(false)

  return (
    <div className="grid max-w-xl gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('application.buildTitle')}</CardTitle>
          <CardDescription>{t('application.buildDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {info && (
            <>
              <InfoRow label={t('application.version')} value={info.version} />
              <InfoRow label={t('application.commit')} value={info.commit ?? '—'} />
              <InfoRow label={t('application.pythonVersion')} value={info.python_version} />
              <InfoRow label={t('application.platform')} value={info.platform} />
              <InfoRow label={t('application.uptime')} value={formatUptime(info.started_at)} />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('application.updatesTitle')}</CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCwIcon className={cn('size-4', isFetching && 'animate-spin')} />
            {t('application.checkForUpdates')}
          </Button>
        </CardHeader>
        {updateCheck && (
          <CardContent className="text-sm">
            {updateCheck.note ? (
              <p className="text-muted-foreground">{updateCheck.note}</p>
            ) : updateCheck.update_available ? (
              <p className="font-medium">
                {t('application.updateAvailable', { version: updateCheck.latest_version ?? '' })}
              </p>
            ) : (
              <p className="text-muted-foreground">{t('application.upToDate')}</p>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  )
}
