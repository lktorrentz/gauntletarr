import { ChevronRightIcon, LogOutIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { useDashboard } from '@/api/hooks/dashboard'
import { useHealth } from '@/api/hooks/health'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useAuth } from '@/contexts/AuthContext'
import { t } from '@/lib/i18n'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { NAV_DASHBOARD, NAV_GROUPS } from '@/lib/nav'

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return t('layout.timeNever')
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return t('layout.timeNow')
  if (minutes < 60) return t('layout.timeMinutesAgo', { minutes })
  const hours = Math.round(minutes / 60)
  if (hours < 24) return t('layout.timeHoursAgo', { hours })
  return t('layout.timeDaysAgo', { days: Math.round(hours / 24) })
}

function StatBox({ dotClassName, label, value }: { dotClassName: string; label: string; value: string }) {
  return (
    <div className="rounded-md border bg-sidebar-accent/40 px-2 py-1.5">
      <div className="flex items-center gap-1.5">
        <span className={cn('size-1.5 shrink-0 rounded-full', dotClassName)} />
        <span className="truncate text-[11px] font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="mt-0.5 font-mono text-sm font-semibold">{value}</p>
    </div>
  )
}

// Ispirato al footer sidebar di Auditorr (progetto di provenienza, vedi
// docs/SPEC.md §0): due box di statistiche affiancati + orario
// dell'ultima scansione, sempre visibili senza dover aprire la
// Dashboard. Auditorr non mostra una versione in UI; qui aggiunta su
// richiesta esplicita (GET /api/health, app/version.py).
function AppSidebarFooter() {
  const { data: dashboard } = useDashboard()
  const { data: health } = useHealth()
  const { username, logout } = useAuth()

  return (
    <SidebarFooter className="gap-2 border-t px-3 py-3 group-data-[collapsible=icon]:hidden">
      <div className="grid grid-cols-2 gap-1.5">
        <StatBox
          dotClassName="bg-emerald-500"
          label={t('layout.health')}
          value={dashboard ? `${Math.round(dashboard.health_pct)}/100` : '—'}
        />
        <StatBox
          dotClassName="bg-amber-500"
          label={t('layout.toReview')}
          value={dashboard ? String(dashboard.pending_review) : '—'}
        />
      </div>
      <p className="font-mono text-[11px] text-muted-foreground">
        {t('layout.lastRun', { time: relativeTime(dashboard?.last_run?.finished_at) })}
      </p>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <a href="/docs" target="_blank" rel="noreferrer" className="hover:underline">
          {t('layout.apiDocs')}
        </a>
        <span title={health?.commit ? `commit ${health.commit}` : undefined}>
          v{health?.version ?? '…'}
          {health?.commit && <span className="opacity-60"> · {health.commit}</span>}
        </span>
      </div>
      <div className="flex items-center justify-between border-t pt-2">
        <ThemeToggle />
        {username && (
          <Button variant="ghost" size="icon-sm" title={t('layout.logout', { username })} onClick={logout}>
            <LogOutIcon className="size-4" />
          </Button>
        )}
      </div>
    </SidebarFooter>
  )
}

export function AppSidebar() {
  const location = useLocation()
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(NAV_GROUPS.map((g) => g.title)))

  function toggleGroup(title: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-4 group-data-[collapsible=icon]:hidden">
        <span className="truncate text-base font-semibold tracking-tight">The Media Gauntlet*rr</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="px-2 py-0.5">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link to={NAV_DASHBOARD.to} />}
                  isActive={location.pathname === NAV_DASHBOARD.to}
                  tooltip={NAV_DASHBOARD.title}
                >
                  <NAV_DASHBOARD.icon className="size-4" />
                  {NAV_DASHBOARD.title}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {NAV_GROUPS.map((group) => {
          // Un gruppo con una sola voce non ha bisogno di un dropdown —
          // si comporta come Dashboard: link piatto con icona e titolo
          // del gruppo, evidenziato anche sulle sue sotto-route (es.
          // /upload/new, /upload/123 restano "dentro" Upload).
          if (group.items.length === 1) {
            const item = group.items[0]
            const isActive = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
            return (
              <SidebarGroup key={group.title} className="px-2 py-0.5">
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        render={<Link to={item.to} />}
                        isActive={isActive}
                        tooltip={group.title}
                      >
                        <group.icon className="size-4" />
                        {group.title}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )
          }

          const open = openGroups.has(group.title)
          return (
            <SidebarGroup key={group.title} className="px-2 py-0.5">
              <SidebarGroupContent>
                <SidebarMenu>
                  <Collapsible open={open} onOpenChange={() => toggleGroup(group.title)}>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        render={<CollapsibleTrigger className="w-full cursor-pointer" />}
                        tooltip={group.title}
                      >
                        <group.icon className="size-4" />
                        <span className="flex-1">{group.title}</span>
                        <ChevronRightIcon
                          className={cn(
                            'size-4 shrink-0 transition-transform group-data-[collapsible=icon]:hidden',
                            open && 'rotate-90'
                          )}
                        />
                      </SidebarMenuButton>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {group.items.map((item) => (
                            <SidebarMenuSubItem key={item.to}>
                              <SidebarMenuSubButton
                                render={<Link to={item.to} />}
                                isActive={location.pathname === item.to}
                              >
                                {item.title}
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}
      </SidebarContent>
      <AppSidebarFooter />
      <SidebarRail />
    </Sidebar>
  )
}
