import { LogOutIcon } from 'lucide-react'
import { Outlet } from 'react-router-dom'

import { AppSidebar } from '@/components/layout/AppSidebar'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useAuth } from '@/contexts/AuthContext'

export function AppLayout() {
  const { username, logout } = useAuth()

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center justify-end gap-2 border-b px-3">
          {username && (
            <Button variant="ghost" size="icon-sm" title={`Esci (${username})`} onClick={logout}>
              <LogOutIcon className="size-4" />
            </Button>
          )}
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
