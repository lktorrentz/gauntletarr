import { PlusIcon, SettingsIcon, TrashIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { useBundledUploadProfiles, useCreateTracker, useDeleteTracker, useTrackers, useUpdateTracker } from '@/api/hooks/trackers'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { selectLabel } from '@/lib/utils'
import { UploadProfileDialog } from '@/pages/config/UploadProfileDialog'

function AddTrackerDialog() {
  const [open, setOpen] = useState(false)
  const [presetKey, setPresetKey] = useState('')
  const [label, setLabel] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [announceUrl, setAnnounceUrl] = useState('')
  const createTracker = useCreateTracker()
  const { data: bundled } = useBundledUploadProfiles()

  function applyPreset(key: string) {
    setPresetKey(key)
    const preset = bundled?.find((p) => p.key === key)
    if (!preset) return
    if (!label) setLabel(preset.label)
    if (preset.base_url) setBaseUrl(preset.base_url)
  }

  function reset() {
    setPresetKey('')
    setLabel('')
    setBaseUrl('')
    setApiToken('')
    setAnnounceUrl('')
  }

  function submit() {
    createTracker.mutate(
      { label, adapter_type: 'unit3d', base_url: baseUrl, api_token: apiToken, announce_url: announceUrl || undefined },
      {
        onSuccess: () => {
          setOpen(false)
          reset()
        },
        onError: (error) => toast.error(`Creazione fallita: ${error.message}`),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button><PlusIcon className="size-4" />Aggiungi tracker</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aggiungi tracker</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Preset</Label>
            <Select value={presetKey} onValueChange={applyPreset}>
              <SelectTrigger>
                <SelectValue placeholder="Tracker esistente o personalizzato…">
                  {(v: string | null) =>
                    selectLabel(bundled, v, (p) => p.key, (p) => p.label, 'Tracker esistente o personalizzato…')
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {bundled?.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Precompila etichetta e URL API — restano modificabili, e un tracker non in lista si configura
              compilando i campi sotto a mano.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="t-label">Etichetta</Label>
            <Input id="t-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="mytracker" />
          </div>
          <div className="grid gap-1.5">
            <Label>Tipo</Label>
            <Input value="unit3d" disabled />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="t-base-url">URL API</Label>
            <Input
              id="t-base-url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://mytracker.example"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="t-api-token">API token</Label>
            <Input id="t-api-token" value={apiToken} onChange={(e) => setApiToken(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="t-announce-url">Announce URL (solo per upload)</Label>
            <Input
              id="t-announce-url"
              value={announceUrl}
              onChange={(e) => setAnnounceUrl(e.target.value)}
              placeholder="https://mytracker.example/announce/passkey"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={!label || !baseUrl || !apiToken || createTracker.isPending}>
            Crea
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function TrackersPage() {
  const { data: trackers, isPending } = useTrackers()
  const updateTracker = useUpdateTracker()
  const deleteTracker = useDeleteTracker()
  const [profileTrackerId, setProfileTrackerId] = useState<number | null>(null)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Trackers</CardTitle>
        <AddTrackerDialog />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Etichetta</TableHead>
              <TableHead>URL API</TableHead>
              <TableHead>Announce URL</TableHead>
              <TableHead>Abilitato</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  Caricamento…
                </TableCell>
              </TableRow>
            )}
            {trackers?.map((tracker) => (
              <TableRow key={tracker.id}>
                <TableCell className="font-medium">{tracker.label}</TableCell>
                <TableCell className="font-mono text-xs">{tracker.base_url}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {tracker.announce_url ?? '—'}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={tracker.enabled}
                    onCheckedChange={(enabled) => updateTracker.mutate({ id: tracker.id, body: { enabled } })}
                  />
                </TableCell>
                <TableCell className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Profilo di upload"
                    onClick={() => setProfileTrackerId(tracker.id)}
                  >
                    <SettingsIcon className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => deleteTracker.mutate(tracker.id)}>
                    <TrashIcon className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {trackers?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  Nessun tracker configurato.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      {profileTrackerId !== null && (
        <UploadProfileDialog
          trackerId={profileTrackerId}
          trackerLabel={trackers?.find((t) => t.id === profileTrackerId)?.label ?? ''}
          open
          onOpenChange={(open) => !open && setProfileTrackerId(null)}
        />
      )}
    </Card>
  )
}
