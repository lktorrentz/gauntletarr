import { Link, useLocation } from 'react-router-dom'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { NAV_GROUPS } from '@/lib/nav'

export function AppSidebar() {
  const location = useLocation()

  return (
    <Sidebar>
      <SidebarHeader className="px-3 py-3">
        <span className="text-sm font-semibold tracking-tight">The Media Gauntlet*rr</span>
      </SidebarHeader>
      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>
              <group.icon className="size-4" />
              <span>{group.title}</span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      render={<Link to={item.to} />}
                      isActive={location.pathname === item.to}
                    >
                      {item.title}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="px-3 py-2 text-xs text-muted-foreground">
        <a href="/docs" target="_blank" rel="noreferrer" className="hover:underline">
          API docs (Swagger)
        </a>
      </SidebarFooter>
    </Sidebar>
  )
}
