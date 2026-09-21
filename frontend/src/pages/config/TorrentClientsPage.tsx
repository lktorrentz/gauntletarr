import { HardDriveIcon, PlusIcon, TrashIcon, ZapIcon } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
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
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

function AddTorrentClientDialog() {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const createTorrentClient = useCreateTorrentClient()

  function submit() {
    createTorrentClient.mutate(
      { label, adapter_type: 'qbittorrent', base_url: baseUrl, username: username || undefined, password: password || undefined },
      {
        onSuccess: () => {
          setOpen(false)
          setLabel('')
          setBaseUrl('')
          setUsername('')
          setPassword('')
        },
        onError: (error) => toast.error(`Creazione fallita: ${error.message}`),
      },
    )
  }

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
            <Input value="qbittorrent" disabled />
            <p className="text-xs text-muted-foreground">
              Unico adapter implementato per ora (Deluge/Transmission/rutorrent pianificati).
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tc-base-url">URL</Label>
            <Input
              id="tc-base-url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://qbittorrent:8080"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tc-username">Utente</Label>
            <Input id="tc-username" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tc-password">Password</Label>
            <Input id="tc-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={!label || !baseUrl || createTorrentClient.isPending}>
            Crea
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

export function TorrentClientsPage() {
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
              <TableHead>URL</TableHead>
              <TableHead>Dischi</TableHead>
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
            {torrentClients?.map((tc) => (
              <TableRow key={tc.id}>
                <TableCell className="font-medium">{tc.label}</TableCell>
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
                  <Button variant="ghost" size="icon-sm" onClick={() => deleteTorrentClient.mutate(tc.id)}>
                    <TrashIcon className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {torrentClients?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
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
