import { Outlet, useLocation } from 'react-router-dom'

import { AppSidebar } from '@/components/layout/AppSidebar'
import { RunNowButton } from '@/components/RunNowButton'
import { RunStatusIndicator } from '@/components/RunStatusIndicator'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { NAV_DASHBOARD, resolveSectionTitle } from '@/lib/nav'

function TopHeader() {
  const location = useLocation()
  const { parent, title } = resolveSectionTitle(location.pathname)

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-4" />
      <div className="flex flex-1 items-center gap-1.5 text-sm">
        {parent && <span className="text-muted-foreground">{parent}</span>}
        {parent && <span className="text-muted-foreground">/</span>}
        <span className="font-medium">{title}</span>
      </div>
      {location.pathname === NAV_DASHBOARD.to && <RunNowButton />}
    </header>
  )
}

export function AppLayout() {
  return (
    <SidebarProvider className="h-svh">
      <AppSidebar />
      <SidebarInset className="h-svh overflow-hidden">
        <TopHeader />
        <div className="flex-1 overflow-auto p-6">
          <Outlet />
        </div>
      </SidebarInset>
      <RunStatusIndicator />
    </SidebarProvider>
  )
}
