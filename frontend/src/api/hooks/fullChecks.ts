import { useMutation, useQuery } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'

export interface FullCheckTarget {
  candidateId: number
  seedJobId?: number | null
}

export function useStartFullCheck() {
  return useMutation({
    mutationFn: (target: FullCheckTarget) =>
      unwrap(
        api.POST('/api/full-checks', {
          body: { candidate_id: target.candidateId, seed_job_id: target.seedJobId ?? null },
        }),
      ),
  })
}

// Stato del controllo in background: si interroga ogni secondo finché è in
// coda o in corso, poi si ferma.
export function useFullCheck(id: string | null) {
  return useQuery({
    queryKey: ['full-checks', id],
    queryFn: () => unwrap(api.GET('/api/full-checks/{check_id}', { params: { path: { check_id: id! } } })),
    enabled: id !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'queued' || status === 'running' || status === undefined ? 1000 : false
    },
  })
}

export function useCancelFullCheck() {
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.POST('/api/full-checks/{check_id}/cancel', { params: { path: { check_id: id } } })),
  })
}
