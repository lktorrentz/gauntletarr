import { useState } from 'react'

import { useSeedFiles } from '@/api/hooks/library'
import { FileFilterBar } from '@/components/FileFilterBar'
import { FileTree } from '@/components/FileTree'
import { Card, CardContent } from '@/components/ui/card'

export function TorrentFolderView() {
  const { data, isPending } = useSeedFiles()
  const [statusFilter, setStatusFilter] = useState<'all' | 'seeding' | 'problem'>('all')
  const [showExcluded, setShowExcluded] = useState(false)

  if (isPending) return <p className="text-sm text-muted-foreground">Caricamento…</p>

  const files = data ?? []

  return (
    <div className="grid gap-3">
      <FileFilterBar
        files={files}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        showExcluded={showExcluded}
        onShowExcludedChange={setShowExcluded}
      />
      <Card>
        <CardContent className="pt-4">
          <FileTree files={files} statusFilter={statusFilter} showExcluded={showExcluded} />
        </CardContent>
      </Card>
    </div>
  )
}
