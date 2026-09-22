import { useDashboard, useDashboardHistory, useDashboardWhatsNew } from '@/api/hooks/dashboard'
import { useUploads } from '@/api/hooks/uploads'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Sparkline } from '@/components/Sparkline'
import { t } from '@/lib/i18n'

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

// Panoramica sull'intero stato dell'app (Library + Reseeding + Upload),
// non solo sul reseeding — promossa a pagina di primo livello su
// richiesta esplicita dell'utente dopo la Sotto-fase 8.2 (prima stava
// sotto "Reseeding", dando l'impressione di riguardare solo quell'area).
export function DashboardPage() {
  const { data, isPending } = useDashboard()
  const { data: history } = useDashboardHistory()
  const { data: whatsNew } = useDashboardWhatsNew()
  const { data: uploads } = useUploads()

  if (isPending || !data) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  }

  const uploadCounts = {
    draft: uploads?.filter((u) => u.status === 'draft').length ?? 0,
    ready: uploads?.filter((u) => u.status === 'ready').length ?? 0,
    uploading: uploads?.filter((u) => u.status === 'uploading').length ?? 0,
    uploaded: uploads?.filter((u) => u.status === 'uploaded').length ?? 0,
    failed: uploads?.filter((u) => u.status === 'failed').length ?? 0,
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.libraryHealth')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-3xl font-semibold">{data.health_pct.toFixed(1)}%</p>
            <Progress value={data.health_pct} />
            <p className="text-xs text-muted-foreground">
              {t('dashboard.seedingOfTotal', {
                seeding: (data.seeding_media_size / 1e9).toFixed(1),
                total: (data.total_media_size / 1e9).toFixed(1),
              })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.healthHistory')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Sparkline points={[...(history ?? [])].reverse().map((h) => h.health_snapshot)} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Library</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Stat label={t('dashboard.unresolved')} value={data.unmatched} />
            <Stat label="Orphan torrent" value={data.orphan_torrent_count} />
            <Stat label={t('dashboard.ignored')} value={data.ignored_count} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reseeding</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Stat label={t('dashboard.pendingReview')} value={data.pending_review} />
            <Stat label={t('dashboard.failed')} value={data.failed} />
            {data.last_run && <Stat label={t('dashboard.lastRunMatches')} value={data.last_run.matches_found} />}
            {data.last_run && <Stat label={t('dashboard.lastRunAutoExecuted')} value={data.last_run.auto_executed} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upload</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Stat label={t('dashboard.drafts')} value={uploadCounts.draft} />
            <Stat label={t('dashboard.ready')} value={uploadCounts.ready} />
            <Stat label={t('dashboard.uploaded')} value={uploadCounts.uploaded} />
            <Stat label={t('dashboard.failed')} value={uploadCounts.failed} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.whatsNew')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {whatsNew?.length === 0 && <p className="text-sm text-muted-foreground">{t('dashboard.nothingNew')}</p>}
          {whatsNew?.map((item) => (
            <div key={item.candidate_id} className="flex items-center justify-between gap-2 border-b pb-2 text-sm last:border-b-0">
              <span className="truncate">{item.name}</span>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="secondary">{item.direction}</Badge>
                <span className="text-xs text-muted-foreground">{(item.confidence * 100).toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
