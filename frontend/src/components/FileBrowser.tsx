import { useMemo, useState } from 'react'

import { FileFilterBar } from '@/components/FileFilterBar'
import { FileTree, type TreeFileEntry } from '@/components/FileTree'
import { LibrarySummaryCards } from '@/components/LibrarySummaryCards'
import { Card } from '@/components/ui/card'
import {
  DEFAULT_FILTERS,
  filterFiles,
  hasActiveSearchFilters,
  summarizeByState,
  type LibraryFilters,
  type StatusOption,
} from '@/lib/library-filters'

// Struttura comune a "Media files" e "Torrent files": stesse card, stessa
// toolbar, stesso tree — cambiano solo il dataset e gli stati possibili.
export function FileBrowser({
  files,
  statusOptions,
  duplicateKeys,
}: {
  files: TreeFileEntry[]
  statusOptions: StatusOption[]
  // Solo Media files: senza, il filtro Duplicates non compare.
  duplicateKeys?: Set<string>
}) {
  const [filters, setFilters] = useState<LibraryFilters>(DEFAULT_FILTERS)

  const summary = useMemo(() => summarizeByState(files), [files])
  const excludedCount = useMemo(() => files.filter((f) => f.excluded).length, [files])
  const filtered = useMemo(() => filterFiles(files, filters, duplicateKeys), [files, filters, duplicateKeys])

  return (
    <div className="grid gap-4">
      <LibrarySummaryCards
        statusOptions={statusOptions}
        summary={summary}
        activeStatus={filters.status}
        onSelect={(status) => setFilters({ ...filters, status })}
      />
      <FileFilterBar
        statusOptions={statusOptions}
        summary={summary}
        excludedCount={excludedCount}
        filters={filters}
        onFiltersChange={setFilters}
        duplicateCount={duplicateKeys?.size}
      />
      <Card className="py-0">
        {/* Con una ricerca attiva ogni risultato va reso visibile subito,
            non sepolto in una cartella chiusa. */}
        <FileTree files={filtered} expandAll={hasActiveSearchFilters(filters)} duplicateKeys={duplicateKeys} />
      </Card>
    </div>
  )
}
