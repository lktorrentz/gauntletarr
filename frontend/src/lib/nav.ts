import {
  FolderTree,
  Gauge,
  HardDriveDownload,
  LayoutDashboard,
  Settings,
  UploadCloud,
  type LucideIcon,
} from 'lucide-react'

// Struttura di navigazione da docs/SPEC.md §10, con aggiustamenti su
// richiesta esplicita dell'utente:
// - Dashboard promossa a voce di primo livello (non più sotto Reseeding):
//   dà una panoramica sull'intero stato dell'app (libreria, reseeding,
//   upload), non solo sul reseeding.
// - Un gruppo con una sola voce si mostra come link piatto (icona +
//   titolo del gruppo, nessun dropdown) — vedi AppSidebar.tsx. Library è
//   l'unico gruppo rimasto con più voci (Poster/Folder view), quindi
//   l'unico ancora collassabile.
// "Verify from .torrent" e "Description templates" restano deliberatamente
// fuori da questa fase (vedi piano Fase 8): il primo non ha ancora un
// endpoint API dedicato, il secondo è già raggiungibile editando il
// profilo di upload di un tracker (Configuration > Integrations).
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
    items: [{ title: 'Torrent', to: '/torrent/folder' }],
  },
  {
    title: 'Reseeding',
    icon: Gauge,
    items: [{ title: 'Reseeding', to: '/reseeding' }],
  },
  {
    title: 'Upload',
    icon: UploadCloud,
    items: [{ title: 'Upload', to: '/upload' }],
  },
  {
    title: 'Configuration',
    icon: Settings,
    items: [{ title: 'Configuration', to: '/config' }],
  },
]
