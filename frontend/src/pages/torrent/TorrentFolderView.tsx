import { useSeedFiles } from '@/api/hooks/library'
import { FileBrowser } from '@/components/FileBrowser'
import { t } from '@/lib/i18n'
import type { StatusOption } from '@/lib/library-filters'

const STATUS_OPTIONS: StatusOption[] = [
  { value: 'all', label: t('library.stateAll') },
  { value: 'seeding', label: t('library.stateSeeding') },
  { value: 'ignored', label: t('library.stateIgnored') },
  { value: 'orphan_torrent', label: t('library.stateOrphanTorrent') },
]

export function TorrentFolderView() {
  const { data, isPending } = useSeedFiles()

  if (isPending) return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>

  return <FileBrowser files={data ?? []} statusOptions={STATUS_OPTIONS} />
}
