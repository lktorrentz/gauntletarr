import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'

export function useRuns() {
  return useQuery({
    queryKey: ['runs'],
    queryFn: () => unwrap(api.GET('/api/runs')),
    // Ripolla finché almeno una run è ancora in corso (finished_at nullo) —
    // così la pagina si aggiorna da sola durante un bulk import, senza un
    // websocket dedicato per uno scenario così poco frequente.
    refetchInterval: (query) => {
      const runs = query.state.data
      const anyInProgress = runs?.some((r) => r.finished_at === null)
      return anyInProgress ? 3_000 : false
    },
  })
}

export function useTriggerRun() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => unwrap(api.POST('/api/runs')),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runs'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
