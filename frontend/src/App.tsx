import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { AppLayout } from '@/components/layout/AppLayout'
import { ComingSoon } from '@/pages/ComingSoon'
import { DisksPage } from '@/pages/config/DisksPage'
import { TorrentClientsPage } from '@/pages/config/TorrentClientsPage'
import { TrackersPage } from '@/pages/config/TrackersPage'
import { SettingsPage } from '@/pages/config/SettingsPage'
import { DashboardPage } from '@/pages/reseeding/DashboardPage'
import { RunsPage } from '@/pages/reseeding/RunsPage'
import { NAV_GROUPS } from '@/lib/nav'

// Ogni voce di NAV_GROUPS diventa una route: ComingSoon di default, sostituita
// da una pagina reale via `overrides` man mano che le sotto-fasi della Fase 8
// la implementano (vedi il piano). Un solo posto dove aggiungere una nuova
// pagina reale, mai due elenchi di route da tenere sincronizzati a mano.
const overrides: Record<string, ReactNode> = {
  '/reseeding/dashboard': <DashboardPage />,
  '/reseeding/runs': <RunsPage />,
  '/config/disks': <DisksPage />,
  '/config/torrent-clients': <TorrentClientsPage />,
  '/config/trackers': <TrackersPage />,
  '/config/settings': <SettingsPage />,
}

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/reseeding/dashboard" replace />} />
        {NAV_GROUPS.flatMap((group) => group.items).map((item) => (
          <Route key={item.to} path={item.to} element={overrides[item.to] ?? <ComingSoon title={item.title} />} />
        ))}
      </Route>
    </Routes>
  )
}

export default App
