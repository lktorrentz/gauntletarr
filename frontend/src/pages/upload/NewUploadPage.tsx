import { CheckIcon } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { useDisks } from '@/api/hooks/disks'
import { useTorrentClients } from '@/api/hooks/torrentClients'
import { useTrackers, useUploadProfile } from '@/api/hooks/trackers'
import {
  useConfirmUpload,
  useCreateUpload,
  useDupeCheck,
  usePatchUpload,
  usePrepareUpload,
  useUpload,
} from '@/api/hooks/uploads'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DiskBrowserDialog } from '@/pages/config/DiskBrowserDialog'
import { selectLabel } from '@/lib/utils'

export function CreateUploadForm({ onCreated }: { onCreated: (id: number) => void }) {
  const { data: disks } = useDisks()
  const { data: trackers } = useTrackers()
  const [diskId, setDiskId] = useState<number | null>(null)
  const [relativePath, setRelativePath] = useState('')
  const [trackerId, setTrackerId] = useState<number | null>(null)
  const [browserOpen, setBrowserOpen] = useState(false)
  const createUpload = useCreateUpload()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuovo upload</CardTitle>
        <CardDescription>Scegli il tracker e il file locale già presente sul disco.</CardDescription>
      </CardHeader>
      <CardContent className="grid max-w-md gap-3">
        <div className="grid gap-1.5">
          <Label>Tracker</Label>
          <Select value={trackerId ? String(trackerId) : ''} onValueChange={(v) => setTrackerId(Number(v))}>
            <SelectTrigger>
              <SelectValue placeholder="Scegli un tracker…">
                {(v: string | null) => selectLabel(trackers, v, (t) => String(t.id), (t) => t.label, 'Scegli un tracker…')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {trackers?.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label>Disco</Label>
          <Select value={diskId ? String(diskId) : ''} onValueChange={(v) => setDiskId(Number(v))}>
            <SelectTrigger>
              <SelectValue placeholder="Scegli un disco…">
                {(v: string | null) => selectLabel(disks, v, (d) => String(d.id), (d) => d.label, 'Scegli un disco…')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {disks?.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {diskId !== null && (
          <div className="grid gap-1.5">
            <Label>File sorgente</Label>
            <Button variant="outline" onClick={() => setBrowserOpen(true)}>
              {relativePath || 'Scegli un file…'}
            </Button>
            <DiskBrowserDialog
              diskId={diskId}
              open={browserOpen}
              onOpenChange={setBrowserOpen}
              onSelect={setRelativePath}
              title="Scegli il file da caricare"
              mode="file"
            />
          </div>
        )}

        <Button
          disabled={!diskId || !relativePath || !trackerId || createUpload.isPending}
          onClick={() =>
            diskId &&
            trackerId &&
            createUpload.mutate(
              { disk_id: diskId, relative_path: relativePath, tracker_id: trackerId },
              {
                onSuccess: (job) => onCreated(job.id),
                onError: (error) => toast.error(`Creazione fallita: ${error.message}`),
              },
            )
          }
        >
          Crea bozza
        </Button>
      </CardContent>
    </Card>
  )
}

function DraftStep({ jobId }: { jobId: number }) {
  const { data: job } = useUpload(jobId)
  const prepare = usePrepareUpload()
  const patch = usePatchUpload()
  const [tmdbDraft, setTmdbDraft] = useState<string | null>(null)

  if (!job) return null
  const tmdbValue = tmdbDraft ?? (job.tmdb_id != null ? String(job.tmdb_id) : '')

  return (
    <Card>
      <CardHeader>
        <CardTitle>Identificazione contenuto</CardTitle>
        <CardDescription>
          {job.tmdb_id != null
            ? `Risolto automaticamente: tmdb_id ${job.tmdb_id}.`
            : 'Non risolto automaticamente — imposta manualmente il tmdb_id prima di preparare.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex max-w-md items-end gap-2">
        <div className="grid flex-1 gap-1.5">
          <Label htmlFor="tmdb-id">tmdb_id</Label>
          <Input id="tmdb-id" value={tmdbValue} onChange={(e) => setTmdbDraft(e.target.value)} />
        </div>
        <Button
          variant="outline"
          onClick={() =>
            patch.mutate(
              { uploadId: jobId, body: { tmdb_id: Number(tmdbValue) } },
              { onError: (error) => toast.error(`Salvataggio fallito: ${error.message}`) },
            )
          }
        >
          Salva
        </Button>
        <Button
          disabled={prepare.isPending}
          onClick={() =>
            prepare.mutate(jobId, {
              onSuccess: () => toast.success('Preparazione completata.'),
              onError: (error) => toast.error(`Preparazione fallita: ${error.message}`),
            })
          }
        >
          {prepare.isPending ? 'Preparazione in corso…' : 'Prepara'}
        </Button>
      </CardContent>
    </Card>
  )
}

function ReadyStep({ jobId }: { jobId: number }) {
  const { data: job } = useUpload(jobId)
  const { data: profile } = useUploadProfile(job?.tracker_id ?? 0)
  const { data: torrentClients } = useTorrentClients()
  const patch = usePatchUpload()
  const dupeCheck = useDupeCheck(jobId)
  const confirm = useConfirmUpload()

  const [descriptionDraft, setDescriptionDraft] = useState<string | null>(null)
  const [tmdbDraft, setTmdbDraft] = useState<string | null>(null)
  const [torrentClientId, setTorrentClientId] = useState<number | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (!job) return null

  const categoryOptions = Object.entries(profile?.category_id_map ?? {})
  const typeOptions = Object.entries(profile?.type_id_map ?? {})
  const resolutionOptions = Object.entries(profile?.resolution_id_map ?? {})
  const description = descriptionDraft ?? job.description_rendered ?? ''
  const tmdbValue = tmdbDraft ?? (job.tmdb_id != null ? String(job.tmdb_id) : '')

  function labelFor(options: [string, number][], value: string | null) {
    return selectLabel(options, value, ([, id]) => String(id), ([key]) => key, '—')
  }

  function patchField(field: 'category_id' | 'type_id' | 'resolution_id', value: string) {
    patch.mutate(
      { uploadId: jobId, body: { [field]: Number(value) } },
      { onError: (error) => toast.error(`Salvataggio fallito: ${error.message}`) },
    )
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Campi risolti</CardTitle>
          <CardDescription>
            type_id è sempre un guess best-effort da guessit — verificalo prima di confermare.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid max-w-2xl grid-cols-4 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ready-tmdb-id">tmdb_id</Label>
            <div className="flex items-center gap-1">
              <Input id="ready-tmdb-id" value={tmdbValue} onChange={(e) => setTmdbDraft(e.target.value)} />
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() =>
                  patch.mutate(
                    { uploadId: jobId, body: { tmdb_id: Number(tmdbValue) } },
                    { onError: (error) => toast.error(`Salvataggio fallito: ${error.message}`) },
                  )
                }
              >
                <CheckIcon className="size-4" />
              </Button>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Categoria</Label>
            <Select value={job.category_id ? String(job.category_id) : ''} onValueChange={(v) => patchField('category_id', v)}>
              <SelectTrigger>
                <SelectValue placeholder="—">{(v: string | null) => labelFor(categoryOptions, v)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map(([key, id]) => (
                  <SelectItem key={key} value={String(id)}>
                    {key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Tipo</Label>
            <Select value={job.type_id ? String(job.type_id) : ''} onValueChange={(v) => patchField('type_id', v)}>
              <SelectTrigger>
                <SelectValue placeholder="—">{(v: string | null) => labelFor(typeOptions, v)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map(([key, id]) => (
                  <SelectItem key={key} value={String(id)}>
                    {key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Risoluzione</Label>
            <Select
              value={job.resolution_id ? String(job.resolution_id) : ''}
              onValueChange={(v) => patchField('resolution_id', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="—">{(v: string | null) => labelFor(resolutionOptions, v)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {resolutionOptions.map(([key, id]) => (
                  <SelectItem key={key} value={String(id)}>
                    {key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {job.screenshot_urls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Screenshot</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {job.screenshot_urls.map((url) => (
              <img key={url} src={url} alt="" className="rounded border" />
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Descrizione</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          <Textarea rows={8} className="font-mono text-xs" value={description} onChange={(e) => setDescriptionDraft(e.target.value)} />
          <Button
            variant="outline"
            className="w-fit"
            onClick={() =>
              patch.mutate(
                { uploadId: jobId, body: { description_rendered: description } },
                { onError: (error) => toast.error(`Salvataggio fallito: ${error.message}`) },
              )
            }
          >
            Salva descrizione
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dupe-check</CardTitle>
          <CardDescription>Verifica esplicita sul tracker prima di procedere.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          <Button variant="outline" className="w-fit" onClick={() => dupeCheck.refetch()} disabled={dupeCheck.isFetching}>
            {dupeCheck.isFetching ? 'Verifica in corso…' : 'Controlla duplicati'}
          </Button>
          {dupeCheck.isError && (
            <p className="text-sm text-destructive">{dupeCheck.error.message}</p>
          )}
          {dupeCheck.data && dupeCheck.data.length === 0 && (
            <p className="text-sm text-muted-foreground">Nessun duplicato trovato.</p>
          )}
          {dupeCheck.data?.map((c) => (
            <div key={c.torrent_id_remote} className="text-sm">
              {c.name} — {(c.size_bytes / 1e9).toFixed(2)} GB
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pubblica</CardTitle>
          <CardDescription>Conferma umana obbligatoria — nessun invio automatico.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <Select value={torrentClientId ? String(torrentClientId) : ''} onValueChange={(v) => setTorrentClientId(Number(v))}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Client per il seeding…">
                {(v: string | null) =>
                  selectLabel(torrentClients, v, (tc) => String(tc.id), (tc) => tc.label, 'Client per il seeding…')
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {torrentClients?.map((tc) => (
                <SelectItem key={tc.id} value={String(tc.id)}>
                  {tc.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger render={<Button disabled={!torrentClientId}>Conferma e pubblica</Button>} />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confermi la pubblicazione?</DialogTitle>
                <DialogDescription>
                  Questa azione invia davvero l'upload al tracker. Non è reversibile da qui.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  disabled={confirm.isPending}
                  onClick={() =>
                    torrentClientId &&
                    confirm.mutate(
                      { uploadId: jobId, torrentClientId },
                      {
                        onSuccess: () => {
                          toast.success('Upload pubblicato.')
                          setConfirmOpen(false)
                        },
                        onError: (error) => toast.error(`Pubblicazione fallita: ${error.message}`),
                      },
                    )
                  }
                >
                  Sì, pubblica ora
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  )
}

function ResultStep({ jobId }: { jobId: number }) {
  const { data: job } = useUpload(jobId)
  if (!job) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Esito
          <Badge variant={job.status === 'uploaded' ? 'default' : 'destructive'}>{job.status}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {job.status === 'uploaded' && <p className="text-sm">torrent_id_remote: {job.torrent_id_remote}</p>}
        {job.status === 'failed' && <p className="text-sm text-destructive">{job.error_message}</p>}
      </CardContent>
    </Card>
  )
}

export function NewUploadPage() {
  const { jobId: jobIdParam } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const jobId = jobIdParam ? Number(jobIdParam) : null
  const { data: job } = useUpload(jobId)

  if (jobId === null || !job) {
    return <CreateUploadForm onCreated={(id) => navigate(`/upload/${id}`)} />
  }
  if (job.status === 'draft') return <DraftStep jobId={jobId} />
  if (job.status === 'ready') return <ReadyStep jobId={jobId} />
  return <ResultStep jobId={jobId} />
}
