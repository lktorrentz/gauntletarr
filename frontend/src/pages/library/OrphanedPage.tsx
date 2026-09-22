import { useMediaFiles, useSeedFiles, useUnmatched } from '@/api/hooks/library'
import { StateBadge } from '@/components/StateBadge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

function formatSize(bytes: number) {
  return `${(bytes / 1e9).toFixed(2)} GB`
}

function FileTable({
  rows,
  emptyLabel,
}: {
  rows: { id: number; relative_path: string; size_bytes: number; state: string }[] | undefined
  emptyLabel: string
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Percorso</TableHead>
          <TableHead>Dimensione</TableHead>
          <TableHead>Stato</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows?.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-mono text-xs">{row.relative_path}</TableCell>
            <TableCell className="text-xs text-muted-foreground">{formatSize(row.size_bytes)}</TableCell>
            <TableCell>
              <StateBadge state={row.state} />
            </TableCell>
          </TableRow>
        ))}
        {rows?.length === 0 && (
          <TableRow>
            <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
              {emptyLabel}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}

export function OrphanedPage() {
  const { data: mediaFiles } = useMediaFiles()
  const { data: seedFiles } = useSeedFiles()
  const { data: unmatched } = useUnmatched()

  const orphanMedia = mediaFiles?.filter((f) => f.state === 'orphan_media')
  const orphanTorrent = seedFiles?.filter((f) => f.state === 'orphan_torrent')
  const ignored = seedFiles?.filter((f) => f.state === 'ignored')

  return (
    <Card>
      <CardContent className="pt-6">
        <Tabs defaultValue="orphan_media">
          <TabsList>
            <TabsTrigger value="orphan_media">Orphan media ({orphanMedia?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="orphan_torrent">Orphan torrent ({orphanTorrent?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="ignored">Ignored ({ignored?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="unmatched">Non risolti ({unmatched?.length ?? 0})</TabsTrigger>
          </TabsList>
          <TabsContent value="orphan_media">
            <FileTable rows={orphanMedia} emptyLabel="Nessun file media orfano." />
          </TabsContent>
          <TabsContent value="orphan_torrent">
            <FileTable rows={orphanTorrent} emptyLabel="Nessun torrent orfano." />
          </TabsContent>
          <TabsContent value="ignored">
            <FileTable rows={ignored} emptyLabel="Nessun file ignorato." />
          </TabsContent>
          <TabsContent value="unmatched">
            <FileTable rows={unmatched} emptyLabel="Tutto risolto." />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
