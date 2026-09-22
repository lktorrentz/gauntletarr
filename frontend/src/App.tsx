import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { AppLayout } from '@/components/layout/AppLayout'
import { ComingSoon } from '@/pages/ComingSoon'
import { DashboardPage } from '@/pages/DashboardPage'
import { DisksPage } from '@/pages/config/DisksPage'
import { TorrentClientsPage } from '@/pages/config/TorrentClientsPage'
import { TrackersPage } from '@/pages/config/TrackersPage'
import { SettingsPage } from '@/pages/config/SettingsPage'
import { RunsPage } from '@/pages/reseeding/RunsPage'
import { ReviewPage } from '@/pages/reseeding/ReviewPage'
import { TreeViewPage } from '@/pages/library/TreeViewPage'
import { GridViewPage } from '@/pages/library/GridViewPage'
import { OrphanedPage } from '@/pages/library/OrphanedPage'
import { NAV_DASHBOARD, NAV_GROUPS } from '@/lib/nav'

// Ogni voce di navigazione (NAV_DASHBOARD + NAV_GROUPS) diventa una route:
// ComingSoon di default, sostituita da una pagina reale via `overrides`
// man mano che le sotto-fasi della Fase 8 la implementano (vedi il
// piano). Un solo posto dove aggiungere una nuova pagina reale, mai due
// elenchi di route da tenere sincronizzati a mano.
const overrides: Record<string, ReactNode> = {
  [NAV_DASHBOARD.to]: <DashboardPage />,
  '/library/tree': <TreeViewPage />,
  '/library/grid': <GridViewPage />,
  '/library/orphaned': <OrphanedPage />,
  '/reseeding/review': <ReviewPage />,
  '/reseeding/runs': <RunsPage />,
  '/config/disks': <DisksPage />,
  '/config/torrent-clients': <TorrentClientsPage />,
  '/config/trackers': <TrackersPage />,
  '/config/settings': <SettingsPage />,
}

const ALL_ITEMS = [NAV_DASHBOARD, ...NAV_GROUPS.flatMap((group) => group.items)]

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to={NAV_DASHBOARD.to} replace />} />
        {ALL_ITEMS.map((item) => (
          <Route key={item.to} path={item.to} element={overrides[item.to] ?? <ComingSoon title={item.title} />} />
        ))}
      </Route>
    </Routes>
  )
}

export default App
