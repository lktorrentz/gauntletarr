import {
  FolderTree,
  Gauge,
  HardDriveDownload,
  LayoutDashboard,
  Settings,
  UploadCloud,
  type LucideIcon,
} from 'lucide-react'

// Struttura di navigazione da docs/SPEC.md §10, con due aggiustamenti su
// richiesta esplicita dell'utente dopo aver visto la Sotto-fase 8.2:
// - Dashboard promossa a voce di primo livello (non più sotto Reseeding):
//   dà una panoramica sull'intero stato dell'app (libreria, reseeding,
//   upload), non solo sul reseeding.
// - I gruppi sono collassabili (vedi AppSidebar.tsx).
// "Verify from .torrent" e "Description templates" restano deliberatamente
// fuori da questa fase (vedi piano Fase 8): il primo non ha ancora un
// endpoint API dedicato, il secondo è già raggiungibile editando il
// profilo di upload di un tracker (Configuration > Trackers).
export interface NavItem {
  title: string
  to: string
}

export interface NavGroup {
  title: string
  icon: LucideIcon
  items: NavItem[]
}

export interface NavLink {
  title: string
  to: string
  icon: LucideIcon
}

export const NAV_DASHBOARD: NavLink = { title: 'Dashboard', to: '/dashboard', icon: LayoutDashboard }

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Library',
    icon: FolderTree,
    items: [
      { title: 'Poster view', to: '/library/poster' },
      { title: 'Folder view', to: '/library/folder' },
    ],
  },
  {
    title: 'Torrent',
    icon: HardDriveDownload,
    items: [{ title: 'Folder view', to: '/torrent/folder' }],
  },
  {
    title: 'Reseeding',
    icon: Gauge,
    items: [
      { title: 'Review', to: '/reseeding/review' },
      { title: 'Runs', to: '/reseeding/runs' },
    ],
  },
  {
    title: 'Upload',
    icon: UploadCloud,
    items: [
      { title: 'New upload', to: '/upload/new' },
      { title: 'Upload queue', to: '/upload/queue' },
    ],
  },
  {
    title: 'Configuration',
    icon: Settings,
    items: [
      { title: 'Disks', to: '/config/disks' },
      { title: 'Torrent clients', to: '/config/torrent-clients' },
      { title: 'Trackers', to: '/config/trackers' },
      { title: 'Settings', to: '/config/settings' },
    ],
  },
]
