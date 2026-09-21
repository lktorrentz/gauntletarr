import { useDashboard, useDashboardHistory, useDashboardWhatsNew } from '@/api/hooks/dashboard'
import { useUploads } from '@/api/hooks/uploads'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Sparkline } from '@/components/Sparkline'

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
    return <p className="text-sm text-muted-foreground">Caricamento…</p>
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
            <CardTitle>Storico salute</CardTitle>
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
            <Stat label="Non risolti" value={data.unmatched} />
            <Stat label="Orphan torrent" value={data.orphan_torrent_count} />
            <Stat label="Ignorati" value={data.ignored_count} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reseeding</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Stat label="In revisione" value={data.pending_review} />
            <Stat label="Falliti" value={data.failed} />
            {data.last_run && <Stat label="Ultima run: match" value={data.last_run.matches_found} />}
            {data.last_run && <Stat label="Ultima run: auto-eseguiti" value={data.last_run.auto_executed} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upload</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Stat label="Bozze" value={uploadCounts.draft} />
            <Stat label="Pronti" value={uploadCounts.ready} />
            <Stat label="Pubblicati" value={uploadCounts.uploaded} />
            <Stat label="Falliti" value={uploadCounts.failed} />
          </CardContent>
        </Card>
      </div>

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
