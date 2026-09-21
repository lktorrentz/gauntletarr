import { useQuery } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => unwrap(api.GET('/api/dashboard')),
    refetchInterval: 15_000,
  })
}

export function useDashboardHistory(limit = 30) {
  return useQuery({
    queryKey: ['dashboard', 'history', limit],
    queryFn: () => unwrap(api.GET('/api/dashboard/history', { params: { query: { limit } } })),
  })
}

export function useDashboardWhatsNew(limit = 20) {
  return useQuery({
    queryKey: ['dashboard', 'whats-new', limit],
    queryFn: () => unwrap(api.GET('/api/dashboard/whats-new', { params: { query: { limit } } })),
  })
}
