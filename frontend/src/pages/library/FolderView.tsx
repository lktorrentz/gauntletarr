import { useState } from 'react'

import { useMediaFiles } from '@/api/hooks/library'
import { FileFilterBar } from '@/components/FileFilterBar'
import { FileTree } from '@/components/FileTree'
import { Card, CardContent } from '@/components/ui/card'
import { t } from '@/lib/i18n'

export function FolderView() {
  const { data, isPending } = useMediaFiles()
  const [statusFilter, setStatusFilter] = useState<'all' | 'seeding' | 'problem'>('all')
  const [showExcluded, setShowExcluded] = useState(false)

  if (isPending) return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>

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
