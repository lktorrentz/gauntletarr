import { useQuery } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => unwrap(api.GET('/api/health')),
    staleTime: Infinity, // la versione non cambia mai finché il processo non riparte
  })
}
