import { EyeOffIcon, SearchIcon } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toggle } from '@/components/ui/toggle'
import { t } from '@/lib/i18n'
import type { LibraryFilters, StateSummary, StatusOption } from '@/lib/library-filters'

export function FileFilterBar({
  statusOptions,
  summary,
  excludedCount,
  filters,
  onFiltersChange,
}: {
  statusOptions: StatusOption[]
  summary: Record<string, StateSummary>
  excludedCount: number
  filters: LibraryFilters
  onFiltersChange: (filters: LibraryFilters) => void
}) {
  const set = <K extends keyof LibraryFilters>(key: K, value: LibraryFilters[K]) =>
    onFiltersChange({ ...filters, [key]: value })

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filters.status} onValueChange={(v) => set('status', v as string)}>
          <TabsList>
            {statusOptions.map((option) => (
              <TabsTrigger key={option.value} value={option.value}>
                {option.label} ({summary[option.value]?.count ?? 0})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {/* Gli esclusi sono fuori da ogni controllo: si vedono solo in "All",
            e solo a toggle premuto. */}
        <Toggle
          variant="outline"
          size="sm"
          pressed={filters.showExcluded}
          onPressedChange={(pressed) => set('showExcluded', pressed)}
          aria-label={t('library.showExcluded')}
        >
          <EyeOffIcon />
          {t('library.showExcluded')} {excludedCount > 0 && `(${excludedCount})`}
        </Toggle>
      </div>
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
      </div>
    </div>
  )
}
