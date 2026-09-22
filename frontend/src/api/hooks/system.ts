import { useQuery } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'

export function useAppInfo() {
  return useQuery({
    queryKey: ['system', 'info'],
    queryFn: () => unwrap(api.GET('/api/system/info')),
  })
}

export function useUpdateCheck(enabled: boolean) {
  return useQuery({
    queryKey: ['system', 'update-check'],
    queryFn: () => unwrap(api.GET('/api/system/update-check')),
    enabled,
    staleTime: 0,
  })
}

export function useLogs(minLevel: string) {
  return useQuery({
    queryKey: ['system', 'logs', minLevel],
    queryFn: () => unwrap(api.GET('/api/system/logs', { params: { query: { min_level: minLevel } } })),
    refetchInterval: 10_000,
  })
}
