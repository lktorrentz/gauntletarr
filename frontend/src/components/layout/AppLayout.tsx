import { MenuIcon } from 'lucide-react'
import { Outlet } from 'react-router-dom'

import { AppSidebar } from '@/components/layout/AppSidebar'
import { Button } from '@/components/ui/button'
import { SidebarInset, SidebarProvider, useSidebar } from '@/components/ui/sidebar'
import { t } from '@/lib/i18n'

function MobileTopbar() {
  const { toggleSidebar } = useSidebar()

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3 md:hidden">
      <Button variant="ghost" size="icon-sm" title={t('layout.openMenu')} onClick={toggleSidebar}>
        <MenuIcon className="size-4" />
      </Button>
      <span className="text-sm font-semibold tracking-tight">The Media Gauntlet*rr</span>
    </header>
  )
}

export function AppLayout() {
  return (
    <SidebarProvider className="h-svh">
      <AppSidebar />
      <SidebarInset className="h-svh overflow-hidden">
        <MobileTopbar />
        <div className="flex-1 overflow-auto p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
