import type { TreeFileEntry } from '@/components/FileTree'

// Unica fonte di verità per i filtri delle viste ad albero (Media files /
// Torrent files): toolbar, card riassuntive e tree leggono tutti da qui,
// invece di filtrare ciascuno per conto proprio. Tutto client-side — le
// API restituiscono già l'intero elenco dei file con il loro stato.
export interface LibraryFilters {
  status: string
  showExcluded: boolean
  search: string
  minGb: string
  maxGb: string
  duplicatesOnly: boolean
}

export const DEFAULT_FILTERS: LibraryFilters = {
  status: 'all',
  showExcluded: false,
  search: '',
  minGb: '',
  maxGb: '',
  duplicatesOnly: false,
}

export interface StatusOption {
  value: string
  label: string
}

const GB = 1e9

// Chiave di un file fra dischi diversi: lo stesso relative_path può
// esistere su due dischi, mai confonderli.
export function fileKey(file: { disk_id?: number; relative_path: string }): string {
  return `${file.disk_id ?? ''}:${file.relative_path}`
}

function parseGb(value: string): number | null {
  if (value.trim() === '') return null
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n * GB : null
}

export function filterFiles(
  files: TreeFileEntry[],
  filters: LibraryFilters,
  duplicateKeys?: Set<string>,
): TreeFileEntry[] {
  const search = filters.search.trim().toLowerCase()
  const min = parseGb(filters.minGb)
  const max = parseGb(filters.maxGb)
  return files.filter((f) => {
    if (!filters.showExcluded && f.excluded) return false
    if (filters.status !== 'all' && f.state !== filters.status) return false
    if (search && !f.relative_path.toLowerCase().includes(search)) return false
    if (min !== null && f.size_bytes < min) return false
    if (max !== null && f.size_bytes > max) return false
    if (filters.duplicatesOnly && !duplicateKeys?.has(fileKey(f))) return false
    return true
  })
}

export function hasActiveSearchFilters(filters: LibraryFilters): boolean {
  return filters.search.trim() !== '' || filters.duplicatesOnly
}

export interface StateSummary {
  count: number
  size: number
}

// I totali riflettono sempre i soli file non esclusi, indipendentemente da
// showExcluded — un file escluso non deve mai "contare", anche mentre
// l'utente lo sta guardando temporaneamente.
export function summarizeByState(files: TreeFileEntry[]): Record<string, StateSummary> {
  const summary: Record<string, StateSummary> = { all: { count: 0, size: 0 } }
  for (const f of files) {
    if (f.excluded) continue
    for (const key of ['all', f.state]) {
      summary[key] ??= { count: 0, size: 0 }
      summary[key].count += 1
      summary[key].size += f.size_bytes
    }
  }
  return summary
}

export function formatBytes(bytes: number): string {
  if (bytes < 1e3) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB', 'PB']
  let value = bytes
  let unit = -1
  do {
    value /= 1e3
    unit += 1
  } while (value >= 1e3 && unit < units.length - 1)
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[unit]}`
}
