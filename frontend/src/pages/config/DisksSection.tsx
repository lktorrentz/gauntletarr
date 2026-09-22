import { CheckCircle2Icon, FolderCogIcon, PencilIcon, PlusIcon, TrashIcon, XCircleIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { useAvailableMounts, useCreateDisk, useDeleteDisk, useDisks, useUpdateDisk, useVerifyDisk } from '@/api/hooks/disks'
import type { Schemas } from '@/api/client'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DiskBrowserDialog } from '@/pages/config/DiskBrowserDialog'
import { MediaPathsDialog } from '@/pages/config/MediaPathsDialog'

type Disk = Schemas['DiskResponse']

function AddDiskDialog() {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [rootPath, setRootPath] = useState('')
  const { data: mounts } = useAvailableMounts()
  const createDisk = useCreateDisk()

  function submit() {
    createDisk.mutate(
      { label, root_path: rootPath },
      {
        onSuccess: () => {
          setOpen(false)
          setLabel('')
          setRootPath('')
        },
        onError: (error) => toast.error(`Creazione disco fallita: ${error.message}`),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button><PlusIcon className="size-4" />Aggiungi disco</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aggiungi disco</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="disk-label">Etichetta</Label>
            <Input id="disk-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="main" />
          </div>
          {mounts?.mounts.length ? (
            <div className="grid gap-1.5">
              <Label>Sottocartelle non ancora registrate</Label>
              <Select value={rootPath} onValueChange={setRootPath}>
                <SelectTrigger>
                  <SelectValue placeholder="Scegli una sottocartella di disk_scan_root…" />
                </SelectTrigger>
                <SelectContent>
                  {mounts.mounts.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Solo un aiuto per il caso multi-disco (un mount per disco fisico, es. /mnt/disk1) — un path diverso,
                incluso disk_scan_root stesso per un mount unico, si scrive direttamente qui sotto.
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Nessuna sottocartella libera sotto disk_scan_root — normale con un mount unico (es. /data): scrivi il
              path direttamente qui sotto.
            </p>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="disk-root-path">root_path</Label>
            <Input
              id="disk-root-path"
              value={rootPath}
              onChange={(e) => setRootPath(e.target.value)}
              placeholder="/data/disk1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={!label || !rootPath || createDisk.isPending}>
            Crea
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function VerifyButton({ diskId }: { diskId: number }) {
  const verify = useVerifyDisk()
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      title="Verifica hardlink (st_dev)"
      onClick={() =>
        verify.mutate(diskId, {
          onSuccess: (result) => {
            if (result.consistent) toast.success('Disco consistente.')
            else toast.warning(result.warning ?? 'Disco non più consistente.')
          },
          onError: (error) => toast.error(`Verifica fallita: ${error.message}`),
        })
      }
    >
      {verify.data?.consistent === false ? (
        <XCircleIcon className="size-4 text-destructive" />
      ) : (
        <CheckCircle2Icon className="size-4" />
      )}
    </Button>
  )
}

function TorrentsRelPathCell({ diskId, value }: { diskId: number; value: string | null }) {
  const [browserOpen, setBrowserOpen] = useState(false)
  const updateDisk = useUpdateDisk()

  return (
    <>
      <button
        className="font-mono text-xs text-muted-foreground hover:underline"
        onClick={() => setBrowserOpen(true)}
      >
        {value || '— imposta —'}
      </button>
      <DiskBrowserDialog
        diskId={diskId}
        open={browserOpen}
        onOpenChange={setBrowserOpen}
        title="Cartella di seeding (torrents_rel_path)"
        onSelect={(path) => updateDisk.mutate({ diskId, body: { torrents_rel_path: path } })}
      />
    </>
  )
}

function EditDiskDialog({ disk }: { disk: Disk }) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState(disk.label)
  const [torrentClientRootPath, setTorrentClientRootPath] = useState(disk.torrent_client_root_path ?? '')
  const updateDisk = useUpdateDisk()

  function submit() {
    updateDisk.mutate(
      { diskId: disk.id, body: { label, torrent_client_root_path: torrentClientRootPath || undefined } },
      {
        onSuccess: () => setOpen(false),
        onError: (error) => toast.error(`Salvataggio fallito: ${error.message}`),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" title="Modifica"><PencilIcon className="size-4" /></Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifica disco</DialogTitle>
          <DialogDescription>root_path non modificabile — elimina e ricrea il disco per cambiarlo.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="disk-edit-label">Etichetta</Label>
            <Input id="disk-edit-label" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>root_path</Label>
            <Input value={disk.root_path} disabled />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="disk-edit-client-root">Percorso lato client torrent</Label>
            <Input
              id="disk-edit-client-root"
              value={torrentClientRootPath}
              onChange={(e) => setTorrentClientRootPath(e.target.value)}
              placeholder="/mnt/disk1"
            />
            <p className="text-xs text-muted-foreground">
              Solo se il client torrent vede questo stesso disco fisico con un path diverso da root_path (mount o
              container diversi) — lascia vuoto se root_path è lo stesso path che il client usa.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={!label || updateDisk.isPending}>
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DisksSection() {
  const { data: disks, isPending } = useDisks()
  const deleteDisk = useDeleteDisk()
  const [mediaPathsDiskId, setMediaPathsDiskId] = useState<number | null>(null)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Disks</CardTitle>
        <AddDiskDialog />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Etichetta</TableHead>
              <TableHead>root_path</TableHead>
              <TableHead>Cartella seeding</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                  Caricamento…
                </TableCell>
              </TableRow>
            )}
            {disks?.map((disk) => (
              <TableRow key={disk.id}>
                <TableCell className="font-medium">{disk.label}</TableCell>
                <TableCell className="font-mono text-xs">{disk.root_path}</TableCell>
                <TableCell>
                  <TorrentsRelPathCell diskId={disk.id} value={disk.torrents_rel_path} />
                </TableCell>
                <TableCell className="flex justify-end gap-1">
                  <VerifyButton diskId={disk.id} />
                  <Button variant="ghost" size="icon-sm" title="Media path" onClick={() => setMediaPathsDiskId(disk.id)}>
                    <FolderCogIcon className="size-4" />
                  </Button>
                  <EditDiskDialog disk={disk} />
                  <Button variant="ghost" size="icon-sm" title="Elimina" onClick={() => deleteDisk.mutate(disk.id)}>
                    <TrashIcon className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {disks?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                  Nessun disco configurato.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      {mediaPathsDiskId !== null && (
        <MediaPathsDialog
          diskId={mediaPathsDiskId}
          diskLabel={disks?.find((d) => d.id === mediaPathsDiskId)?.label ?? ''}
          open
          onOpenChange={(open) => !open && setMediaPathsDiskId(null)}
        />
      )}
    </Card>
  )
}
