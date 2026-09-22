import { HardDriveIcon, PencilIcon, PlusIcon, TrashIcon, ZapIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { useDisks } from '@/api/hooks/disks'
import {
  useAssociateDisk,
  useCreateTorrentClient,
  useDeleteTorrentClient,
  useDissociateDisk,
  useTestTorrentClient,
  useTorrentClients,
  useUpdateTorrentClient,
} from '@/api/hooks/torrentClients'
import type { Schemas } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { selectLabel } from '@/lib/utils'

type TorrentClient = Schemas['TorrentClientResponse']

const ADAPTER_TYPES = [
  { value: 'qbittorrent', label: 'qBittorrent' },
  { value: 'qui', label: 'qui (gestore multi-istanza per qBittorrent)' },
]

function AddTorrentClientDialog() {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [adapterType, setAdapterType] = useState<'qbittorrent' | 'qui'>('qbittorrent')
  const [baseUrl, setBaseUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [quiInstanceId, setQuiInstanceId] = useState('')
  const createTorrentClient = useCreateTorrentClient()
  const isQui = adapterType === 'qui'

  function reset() {
    setLabel('')
    setBaseUrl('')
    setUsername('')
    setPassword('')
    setApiToken('')
    setQuiInstanceId('')
  }

  function submit() {
    createTorrentClient.mutate(
      {
        label,
        adapter_type: adapterType,
        base_url: baseUrl,
        username: isQui ? undefined : username || undefined,
        password: isQui ? undefined : password || undefined,
        api_token: isQui ? apiToken || undefined : undefined,
        qui_instance_id: isQui && quiInstanceId ? Number(quiInstanceId) : undefined,
      },
      {
        onSuccess: () => {
          setOpen(false)
          reset()
        },
        onError: (error) => toast.error(`Creazione fallita: ${error.message}`),
      },
    )
  }

  const canSubmit = label && baseUrl && (isQui ? apiToken && quiInstanceId : true)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button><PlusIcon className="size-4" />Aggiungi client</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aggiungi client torrent</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="tc-label">Etichetta</Label>
            <Input id="tc-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="qbit" />
          </div>
          <div className="grid gap-1.5">
            <Label>Tipo</Label>
            <Select value={adapterType} onValueChange={(v) => setAdapterType(v as 'qbittorrent' | 'qui')}>
              <SelectTrigger>
                <SelectValue>
                  {(v: string | null) => selectLabel(ADAPTER_TYPES, v, (a) => a.value, (a) => a.label, 'qBittorrent')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ADAPTER_TYPES.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Deluge/Transmission/rutorrent pianificati, non ancora disponibili.</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tc-base-url">URL</Label>
            <Input
              id="tc-base-url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={isQui ? 'http://qui:7476' : 'http://qbittorrent:8080'}
            />
          </div>
          {isQui ? (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="tc-api-token">API key</Label>
                <Input
                  id="tc-api-token"
                  type="password"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder="Impostazioni → API Keys in qui"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="tc-qui-instance-id">Istanza</Label>
                <Input
                  id="tc-qui-instance-id"
                  type="number"
                  value={quiInstanceId}
                  onChange={(e) => setQuiInstanceId(e.target.value)}
                  placeholder="id numerico dell'istanza qBittorrent gestita da qui"
                />
                <p className="text-xs text-muted-foreground">
                  Un deployment qui gestisce più istanze: questo client punta a una sola (mai scelta a runtime).
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="tc-username">Utente</Label>
                <Input id="tc-username" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="tc-password">Password</Label>
                <Input id="tc-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={!canSubmit || createTorrentClient.isPending}>
            Crea
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditTorrentClientDialog({ tc }: { tc: TorrentClient }) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState(tc.label)
  const [baseUrl, setBaseUrl] = useState(tc.base_url)
  const [username, setUsername] = useState(tc.username ?? '')
  const [password, setPassword] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [quiInstanceId, setQuiInstanceId] = useState(tc.qui_instance_id?.toString() ?? '')
  const updateTorrentClient = useUpdateTorrentClient()
  const isQui = tc.adapter_type === 'qui'

  function submit() {
    updateTorrentClient.mutate(
      {
        id: tc.id,
        body: {
          label,
          base_url: baseUrl,
          username: isQui ? undefined : username || undefined,
          password: isQui ? undefined : password || undefined,
          api_token: isQui ? apiToken || undefined : undefined,
          qui_instance_id: isQui && quiInstanceId ? Number(quiInstanceId) : undefined,
        },
      },
      {
        onSuccess: () => {
          setOpen(false)
          setPassword('')
          setApiToken('')
        },
        onError: (error) => toast.error(`Salvataggio fallito: ${error.message}`),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" title="Modifica"><PencilIcon className="size-4" /></Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifica client torrent</DialogTitle>
          <DialogDescription>Tipo ({tc.adapter_type}) non modificabile — elimina e ricrea per cambiarlo.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="tc-edit-label">Etichetta</Label>
            <Input id="tc-edit-label" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tc-edit-base-url">URL</Label>
            <Input id="tc-edit-base-url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          </div>
          {isQui ? (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="tc-edit-api-token">API key</Label>
                <Input
                  id="tc-edit-api-token"
                  type="password"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder="Lascia vuoto per non cambiarla"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="tc-edit-qui-instance-id">Istanza</Label>
                <Input
                  id="tc-edit-qui-instance-id"
                  type="number"
                  value={quiInstanceId}
                  onChange={(e) => setQuiInstanceId(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="tc-edit-username">Utente</Label>
                <Input id="tc-edit-username" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="tc-edit-password">Password</Label>
                <Input
                  id="tc-edit-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Lascia vuoto per non cambiarla"
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={!label || !baseUrl || updateTorrentClient.isPending}>
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TestButton({ id }: { id: number }) {
  const test = useTestTorrentClient()
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      title="Test connessione"
      onClick={() =>
        test.mutate(id, {
          onSuccess: (result) => {
            if (result.status === 'ok') toast.success(`Connesso — ${result.torrents_found} torrent trovati.`)
            else toast.error(result.error ?? 'Connessione fallita.')
          },
        })
      }
    >
      <ZapIcon className="size-4" />
    </Button>
  )
}

function DisksDialog({ torrentClientId, diskIds }: { torrentClientId: number; diskIds: number[] }) {
  const [open, setOpen] = useState(false)
  const { data: disks } = useDisks()
  const associate = useAssociateDisk()
  const dissociate = useDissociateDisk()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" title="Dischi abilitati"><HardDriveIcon className="size-4" /></Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dischi abilitati per questo client</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          {disks?.map((disk) => {
            const enabled = diskIds.includes(disk.id)
            return (
              <div key={disk.id} className="flex items-center justify-between rounded border px-3 py-2">
                <span className="text-sm">{disk.label}</span>
                <Switch
                  checked={enabled}
                  onCheckedChange={(checked) => {
                    if (checked) associate.mutate({ torrentClientId, diskId: disk.id })
                    else dissociate.mutate({ torrentClientId, diskId: disk.id })
                  }}
                />
              </div>
            )
          })}
          {disks?.length === 0 && <p className="text-sm text-muted-foreground">Nessun disco configurato.</p>}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function TorrentClientsSection() {
  const { data: torrentClients, isPending } = useTorrentClients()
  const { data: disks } = useDisks()
  const updateTorrentClient = useUpdateTorrentClient()
  const deleteTorrentClient = useDeleteTorrentClient()

  const diskLabel = (id: number) => disks?.find((d) => d.id === id)?.label ?? `#${id}`

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Torrent clients</CardTitle>
        <AddTorrentClientDialog />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Etichetta</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Dischi</TableHead>
              <TableHead>Abilitato</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  Caricamento…
                </TableCell>
              </TableRow>
            )}
            {torrentClients?.map((tc) => (
              <TableRow key={tc.id}>
                <TableCell className="font-medium">{tc.label}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {tc.adapter_type}
                    {tc.adapter_type === 'qui' && tc.qui_instance_id !== null ? ` #${tc.qui_instance_id}` : ''}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{tc.base_url}</TableCell>
                <TableCell className="flex flex-wrap gap-1">
                  {tc.disk_ids.length === 0 && <span className="text-xs text-muted-foreground">nessuno</span>}
                  {tc.disk_ids.map((id) => (
                    <Badge key={id} variant="secondary">
                      {diskLabel(id)}
                    </Badge>
                  ))}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={tc.enabled}
                    onCheckedChange={(enabled) => updateTorrentClient.mutate({ id: tc.id, body: { enabled } })}
                  />
                </TableCell>
                <TableCell className="flex justify-end gap-1">
                  <TestButton id={tc.id} />
                  <DisksDialog torrentClientId={tc.id} diskIds={tc.disk_ids} />
                  <EditTorrentClientDialog tc={tc} />
                  <Button variant="ghost" size="icon-sm" title="Elimina" onClick={() => deleteTorrentClient.mutate(tc.id)}>
                    <TrashIcon className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {torrentClients?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  Nessun client torrent configurato.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
