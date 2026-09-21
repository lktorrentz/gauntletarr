import { FolderIcon, FolderPlusIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { useBrowseDisk, useMkdir } from '@/api/hooks/disks'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

/** Selettore di cartella scoped-per-disco (app/fs_scope.py) — riusato sia
 * per una MediaPath sia per torrents_rel_path (docs/SPEC.md §4), mai un
 * campo testo libero: un path sbagliato darebbe solo un 400 al submit. */
export function DiskBrowserDialog({
  diskId,
  open,
  onOpenChange,
  onSelect,
  title,
}: {
  diskId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (relativePath: string) => void
  title: string
}) {
  const [path, setPath] = useState('')
  const [newFolderName, setNewFolderName] = useState('')
  const { data, isPending, isError } = useBrowseDisk(open ? diskId : null, path)
  const mkdir = useMkdir(diskId)

  const segments = path ? path.split('/') : []

  function goTo(index: number) {
    setPath(segments.slice(0, index + 1).join('/'))
  }

  function createFolder() {
    if (!newFolderName.trim()) return
    const target = path ? `${path}/${newFolderName}` : newFolderName
    mkdir.mutate(target, {
      onSuccess: () => {
        setNewFolderName('')
        setPath(target)
      },
      onError: (error) => toast.error(`Creazione cartella fallita: ${error.message}`),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Naviga fino alla cartella e selezionala.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <button className="hover:underline" onClick={() => setPath('')}>
            /
          </button>
          {segments.map((segment, i) => (
            <span key={i} className="flex items-center gap-1">
              <span>/</span>
              <button className="hover:underline" onClick={() => goTo(i)}>
                {segment}
              </button>
            </span>
          ))}
        </div>

        <div className="max-h-64 overflow-auto rounded border">
          {isPending && <p className="p-3 text-sm text-muted-foreground">Caricamento…</p>}
          {isError && <p className="p-3 text-sm text-destructive">Impossibile leggere questa cartella.</p>}
          {data?.entries
            .filter((e) => e.is_dir)
            .map((entry) => (
              <button
                key={entry.name}
                className="flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted"
                onClick={() => setPath(path ? `${path}/${entry.name}` : entry.name)}
              >
                <FolderIcon className="size-4 text-muted-foreground" />
                {entry.name}
              </button>
            ))}
          {data?.entries.filter((e) => e.is_dir).length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">Nessuna sottocartella.</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Input
            placeholder="Nome nuova cartella"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
          />
          <Button variant="outline" size="icon" onClick={createFolder} disabled={mkdir.isPending}>
            <FolderPlusIcon className="size-4" />
          </Button>
        </div>

        <DialogFooter>
          <Button
            onClick={() => {
              onSelect(path)
              onOpenChange(false)
            }}
          >
            Seleziona "{path || '/'}"
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
