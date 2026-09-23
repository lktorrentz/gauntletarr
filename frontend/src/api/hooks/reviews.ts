import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'

export function useReviews() {
  return useQuery({
    queryKey: ['reviews'],
    queryFn: () => unwrap(api.GET('/api/reviews')),
  })
}

export function useApproveReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => unwrap(api.POST('/api/reviews/{review_id}/approve', { params: { path: { review_id: id } } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      queryClient.invalidateQueries({ queryKey: ['reviews', 'failed'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['library'] })
    },
  })
}

export function useRejectReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => unwrap(api.POST('/api/reviews/{review_id}/reject', { params: { path: { review_id: id } } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['library'] })
    },
  })
}

export function useFailedSeedJobs() {
  return useQuery({
    queryKey: ['reviews', 'failed'],
    queryFn: () => unwrap(api.GET('/api/reviews/failed')),
  })
}

export function useRetryFailed() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (seedJobId: number) =>
      unwrap(api.POST('/api/reviews/failed/{seed_job_id}/retry', { params: { path: { seed_job_id: seedJobId } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reviews', 'failed'] }),
  })
}

export function useCandidateAudit(mediaItemId: number | null) {
  return useQuery({
    queryKey: ['reviews', 'candidates', mediaItemId],
    queryFn: () =>
      unwrap(api.GET('/api/reviews/candidates/{media_item_id}', { params: { path: { media_item_id: mediaItemId! } } })),
    enabled: mediaItemId !== null,
  })
}
