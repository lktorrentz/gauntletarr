import { PlusIcon, TrashIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { useCreateMediaPath, useDeleteMediaPath, useMediaPaths, useUpdateMediaPath } from '@/api/hooks/disks'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DiskBrowserDialog } from '@/pages/config/DiskBrowserDialog'

export function MediaPathsDialog({
  diskId,
  diskLabel,
  open,
  onOpenChange,
}: {
  diskId: number
  diskLabel: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: mediaPaths } = useMediaPaths(diskId)
  const createMediaPath = useCreateMediaPath(diskId)
  const updateMediaPath = useUpdateMediaPath(diskId)
  const deleteMediaPath = useDeleteMediaPath(diskId)

  const [browserOpen, setBrowserOpen] = useState(false)
  const [contentType, setContentType] = useState<'movie' | 'tv'>('movie')

  function addMediaPath(relativePath: string) {
    createMediaPath.mutate(
      { relative_path: relativePath, content_type: contentType },
      { onError: (error) => toast.error(`Aggiunta media path fallita: ${error.message}`) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Media path — {diskLabel}</DialogTitle>
        </DialogHeader>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Percorso</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Abilitata</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {mediaPaths?.map((mp) => (
              <TableRow key={mp.id}>
                <TableCell className="font-mono text-xs">{mp.relative_path}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{mp.content_type}</Badge>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={mp.enabled}
                    onCheckedChange={(enabled) => updateMediaPath.mutate({ mediaPathId: mp.id, body: { enabled } })}
                  />
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon-sm" onClick={() => deleteMediaPath.mutate(mp.id)}>
                    <TrashIcon className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {mediaPaths?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                  Nessuna media path configurata.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="flex items-center gap-2">
          <Select value={contentType} onValueChange={(v) => setContentType(v as 'movie' | 'tv')}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="movie">Film</SelectItem>
              <SelectItem value="tv">TV</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setBrowserOpen(true)}>
            <PlusIcon className="size-4" />
            Aggiungi cartella
          </Button>
        </div>
      </DialogContent>

      <DiskBrowserDialog
        diskId={diskId}
        open={browserOpen}
        onOpenChange={setBrowserOpen}
        onSelect={addMediaPath}
        title={`Scegli una cartella (${contentType === 'movie' ? 'film' : 'TV'})`}
      />
    </Dialog>
  )
}
