import { SearchIcon } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { t } from '@/lib/i18n'
import type { LibraryFilters, StateSummary, StatusOption } from '@/lib/library-filters'

export function FileFilterBar({
  statusOptions,
  summary,
  excludedCount,
  filters,
  onFiltersChange,
  duplicateCount,
}: {
  statusOptions: StatusOption[]
  summary: Record<string, StateSummary>
  excludedCount: number
  filters: LibraryFilters
  onFiltersChange: (filters: LibraryFilters) => void
  // Presente solo dove il backend sa calcolare i duplicati (Media files):
  // senza, lo switch Duplicates non viene proprio renderizzato.
  duplicateCount?: number
}) {
  const set = <K extends keyof LibraryFilters>(key: K, value: LibraryFilters[K]) =>
    onFiltersChange({ ...filters, [key]: value })

  return (
    <div className="grid gap-3">
      <Tabs value={filters.status} onValueChange={(v) => set('status', v as string)}>
        <TabsList>
          {statusOptions.map((option) => (
            <TabsTrigger key={option.value} value={option.value}>
              {option.label} ({summary[option.value]?.count ?? 0})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
            placeholder={t('library.searchPlaceholder')}
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Input
            inputMode="decimal"
            value={filters.minGb}
            onChange={(e) => set('minGb', e.target.value)}
            placeholder={t('library.minSize')}
            aria-label={t('library.minSize')}
            className="w-24"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <Input
            inputMode="decimal"
            value={filters.maxGb}
            onChange={(e) => set('maxGb', e.target.value)}
            placeholder={t('library.maxSize')}
            aria-label={t('library.maxSize')}
            className="w-24"
          />
        </div>
        {duplicateCount !== undefined && (
          <div className="flex items-center gap-2">
            <Switch
              id="duplicates-only"
              checked={filters.duplicatesOnly}
              onCheckedChange={(v) => set('duplicatesOnly', v)}
            />
            <Label htmlFor="duplicates-only" className="text-xs text-muted-foreground">
              {t('library.duplicatesOnly')} {duplicateCount > 0 && `(${duplicateCount})`}
            </Label>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Switch
            id="show-excluded"
            checked={filters.showExcluded}
            onCheckedChange={(v) => set('showExcluded', v)}
          />
          <Label htmlFor="show-excluded" className="text-xs text-muted-foreground">
            {t('library.showExcluded')} {excludedCount > 0 && `(${excludedCount})`}
          </Label>
        </div>
      </div>
    </div>
  )
}
