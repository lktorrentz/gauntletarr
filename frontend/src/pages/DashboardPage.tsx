import { PlayIcon, TrendingDownIcon, TrendingUpIcon } from 'lucide-react'
import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'
import { toast } from 'sonner'

import { useDashboard, useDashboardHistory, useDashboardWhatsNew } from '@/api/hooks/dashboard'
import type { Schemas } from '@/api/client'
import { useTriggerRun } from '@/api/hooks/runs'
import { useUploads } from '@/api/hooks/uploads'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroupItem, ToggleGroupSingle } from '@/components/ui/toggle-group'
import { t } from '@/lib/i18n'

type HistoryPoint = Schemas['HistoryPoint']

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

// Confronta gli ultimi due punti di storico (history è ordinata dal più
// recente, vedi app/api/dashboard.py) — null se non c'è ancora una run
// precedente con cui confrontare, mai un delta inventato.
function historyDelta(history: HistoryPoint[] | undefined, field: keyof HistoryPoint): number | null {
  if (!history || history.length < 2) return null
  const [latest, previous] = history
  return (latest[field] as number) - (previous[field] as number)
}

function TrendBadge({ delta, positiveDirection = 'up' }: { delta: number | null; positiveDirection?: 'up' | 'down' }) {
  if (delta === null) return null
  const isUp = delta >= 0
  const isGood = positiveDirection === 'up' ? isUp : !isUp
  const Icon = isUp ? TrendingUpIcon : TrendingDownIcon
  return (
    <Badge variant="outline" className={isGood ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
      <Icon />
      {isUp ? '+' : ''}
      {delta.toFixed(delta % 1 === 0 ? 0 : 1)}
    </Badge>
  )
}

function KpiCard({
  description,
  value,
  delta,
  positiveDirection = 'up',
  headline,
  subline,
}: {
  description: string
  value: string
  delta: number | null
  positiveDirection?: 'up' | 'down'
  headline: string
  subline: string
}) {
  return (
    <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs dark:bg-card">
      <CardHeader>
        <CardDescription>{description}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{value}</CardTitle>
        <CardAction>
          <TrendBadge delta={delta} positiveDirection={positiveDirection} />
        </CardAction>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 border-t-0 bg-transparent text-sm">
        <div className="line-clamp-1 font-medium">{headline}</div>
        <div className="text-muted-foreground">{subline}</div>
      </CardFooter>
    </Card>
  )
}

function HeroCards({ data, history }: { data: NonNullable<ReturnType<typeof useDashboard>['data']>; history: HistoryPoint[] | undefined }) {
  const healthDelta = historyDelta(history, 'health_snapshot')
  const pendingDelta = historyDelta(history, 'pending_review')
  const autoExecutedDelta = historyDelta(history, 'auto_executed')
  const errorsDelta = historyDelta(history, 'errors')

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:shadow-xs sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        description={t('dashboard.libraryHealth')}
        value={`${data.health_pct.toFixed(1)}%`}
        delta={healthDelta}
        headline={
          healthDelta === null
            ? t('dashboard.healthNoHistory')
            : healthDelta > 0
              ? t('dashboard.healthImproving')
              : healthDelta < 0
                ? t('dashboard.healthDeclining')
                : t('dashboard.healthStable')
        }
        subline={t('dashboard.seedingOfTotal', {
          seeding: (data.seeding_media_size / 1e9).toFixed(1),
          total: (data.total_media_size / 1e9).toFixed(1),
        })}
      />
      <KpiCard
        description={t('dashboard.pendingReview')}
        value={String(data.pending_review)}
        delta={pendingDelta}
        positiveDirection="down"
        headline={
          pendingDelta === null
            ? t('dashboard.healthNoHistory')
            : pendingDelta > 0
              ? t('dashboard.backlogGrowing')
              : pendingDelta < 0
                ? t('dashboard.backlogShrinking')
                : t('dashboard.backlogStable')
        }
        subline={t('dashboard.reviewsAwaitingDecision')}
      />
      <KpiCard
        description={t('dashboard.autoExecutedLastRun')}
        value={String(data.last_run?.auto_executed ?? 0)}
        delta={autoExecutedDelta}
        headline={
          autoExecutedDelta === null
            ? t('dashboard.healthNoHistory')
            : autoExecutedDelta > 0
              ? t('dashboard.moreAutoExecuted')
              : autoExecutedDelta < 0
                ? t('dashboard.fewerAutoExecuted')
                : t('dashboard.sameAutoExecuted')
        }
        subline={t('dashboard.aboveConfidenceThreshold')}
      />
      <KpiCard
        description={t('dashboard.errorsLastRun')}
        value={String(data.last_run?.errors ?? 0)}
        delta={errorsDelta}
        positiveDirection="down"
        headline={
          errorsDelta === null
            ? t('dashboard.healthNoHistory')
            : errorsDelta > 0
              ? t('dashboard.moreErrors')
              : errorsDelta < 0
                ? t('dashboard.fewerErrors')
                : t('dashboard.sameErrors')
        }
        subline={t('dashboard.failuresLastRun')}
      />
    </div>
  )
}

const healthChartConfig = {
  health: {
    label: t('dashboard.healthHistory'),
    color: 'var(--primary)',
  },
} satisfies ChartConfig

function formatChartDate(value: string) {
  if (!value) return ''
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function HealthHistoryChart() {
  const [runWindow, setRunWindow] = useState('30')
  const { data: history } = useDashboardHistory(Number(runWindow))
  const chartData = [...(history ?? [])].reverse().map((h) => ({ date: h.finished_at ?? '', health: h.health_snapshot }))

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t('dashboard.healthHistory')}</CardTitle>
        <CardDescription>{t('dashboard.healthHistoryDescription')}</CardDescription>
        <CardAction>
          <ToggleGroupSingle
            value={runWindow}
            onValueChange={setRunWindow}
            variant="outline"
            className="hidden @[500px]/card:flex"
          >
            <ToggleGroupItem value="10">{t('dashboard.last10Runs')}</ToggleGroupItem>
            <ToggleGroupItem value="30">{t('dashboard.last30Runs')}</ToggleGroupItem>
            <ToggleGroupItem value="90">{t('dashboard.last90Runs')}</ToggleGroupItem>
          </ToggleGroupSingle>
          <Select value={runWindow} onValueChange={setRunWindow}>
            <SelectTrigger className="w-40 @[500px]/card:hidden" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">{t('dashboard.last10Runs')}</SelectItem>
              <SelectItem value="30">{t('dashboard.last30Runs')}</SelectItem>
              <SelectItem value="90">{t('dashboard.last90Runs')}</SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {chartData.length < 2 ? (
          <p className="text-sm text-muted-foreground">{t('dashboard.notEnoughHistory')}</p>
        ) : (
          <ChartContainer config={healthChartConfig} className="aspect-auto h-[250px] w-full">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="fillHealth" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-health)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-health)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} tickFormatter={formatChartDate} />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => formatChartDate(String(value))} indicator="dot" />} />
              <Area dataKey="health" type="natural" fill="url(#fillHealth)" stroke="var(--color-health)" />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

// Panoramica sull'intero stato dell'app (Library + Reseeding + Upload),
// non solo sul reseeding — promossa a pagina di primo livello su
// richiesta esplicita dell'utente dopo la Sotto-fase 8.2 (prima stava
// sotto "Reseeding", dando l'impressione di riguardare solo quell'area).
// Struttura hero card + area chart ispirata al blocco dashboard-01 di
// Stesso trigger di ReseedingPage (POST /api/runs) — la Dashboard non ha
// bisogno della tabella run/schedule che sta lì, solo di un modo scopribile
// per lanciare uno scan subito senza dover prima capire che "Reseeding" è
// anche la pagina delle run (richiesta esplicita dell'utente).
function RunNowButton() {
  const triggerRun = useTriggerRun()
  return (
    <Button
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

// shadcn/ui, adattata ai dati reali di questa app (nessun dato finto:
// i trend sui delta vengono dal confronto tra le ultime due run in
// storico, non da percentuali inventate).
export function DashboardPage() {
  const { data, isPending } = useDashboard()
  const { data: history } = useDashboardHistory(2)
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
      <div className="flex justify-end">
        <RunNowButton />
      </div>

      <HeroCards data={data} history={history} />

      <HealthHistoryChart />

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
