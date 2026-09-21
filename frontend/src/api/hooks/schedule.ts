import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'

export function useSchedule() {
  return useQuery({
    queryKey: ['schedule'],
    queryFn: () => unwrap(api.GET('/api/schedule')),
  })
}

export function useSetSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (cron: string | null) => unwrap(api.PUT('/api/schedule', { body: { cron } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedule'] }),
  })
}
