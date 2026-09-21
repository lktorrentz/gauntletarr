import { useDashboard, useDashboardHistory, useDashboardWhatsNew } from '@/api/hooks/dashboard'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Sparkline } from '@/components/Sparkline'

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  )
}

export function DashboardPage() {
  const { data, isPending } = useDashboard()
  const { data: history } = useDashboardHistory()
  const { data: whatsNew } = useDashboardWhatsNew()

  if (isPending || !data) {
    return <p className="text-sm text-muted-foreground">Caricamento…</p>
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Salute libreria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-3xl font-semibold">{data.health_pct.toFixed(1)}%</p>
            <Progress value={data.health_pct} />
            <p className="text-xs text-muted-foreground">
              {(data.seeding_media_size / 1e9).toFixed(1)} GB seeding su {(data.total_media_size / 1e9).toFixed(1)} GB
              totali
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Storico</CardTitle>
          </CardHeader>
          <CardContent>
            <Sparkline points={[...(history ?? [])].reverse().map((h) => h.health_snapshot)} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="In revisione" value={data.pending_review} />
        <StatCard label="Falliti" value={data.failed} />
        <StatCard label="Non risolti" value={data.unmatched} />
        <StatCard label="Orphan torrent" value={data.orphan_torrent_count} />
        <StatCard label="Ignorati" value={data.ignored_count} />
      </div>

      {data.last_run && (
        <Card>
          <CardHeader>
            <CardTitle>Ultima run</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div>
              <p className="text-muted-foreground">Tipo</p>
              <p>{data.last_run.run_type}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Scansionati</p>
              <p>{data.last_run.items_scanned}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Match trovati</p>
              <p>{data.last_run.matches_found}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Auto-eseguiti</p>
              <p>{data.last_run.auto_executed}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Novità</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {whatsNew?.length === 0 && <p className="text-sm text-muted-foreground">Niente di nuovo.</p>}
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
