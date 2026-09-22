import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { TreeFileEntry } from '@/components/FileTree'

export function FileFilterBar({
  files,
  statusFilter,
  onStatusFilterChange,
  showExcluded,
  onShowExcludedChange,
}: {
  files: TreeFileEntry[]
  statusFilter: 'all' | 'seeding' | 'problem'
  onStatusFilterChange: (v: 'all' | 'seeding' | 'problem') => void
  showExcluded: boolean
  onShowExcludedChange: (v: boolean) => void
}) {
  // Le statistiche riflettono sempre i file non esclusi, indipendentemente
  // da showExcluded — un file escluso non deve mai "contare" nei totali,
  // anche mentre l'utente lo sta guardando temporaneamente.
  const counted = files.filter((f) => !f.excluded)
  const seeding = counted.filter((f) => f.state === 'seeding').length
  const problem = counted.length - seeding
  const excludedCount = files.length - counted.length

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Tabs value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as typeof statusFilter)}>
        <TabsList>
          <TabsTrigger value="all">Tutti ({counted.length})</TabsTrigger>
          <TabsTrigger value="seeding">Seeding ({seeding})</TabsTrigger>
          <TabsTrigger value="problem">Da rivedere ({problem})</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex items-center gap-2">
        <Switch id="show-excluded" checked={showExcluded} onCheckedChange={onShowExcludedChange} />
        <Label htmlFor="show-excluded" className="text-xs text-muted-foreground">
          Mostra esclusi {excludedCount > 0 && `(${excludedCount})`}
        </Label>
      </div>
    </div>
  )
}
