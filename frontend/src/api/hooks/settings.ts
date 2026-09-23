import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'

export function useSetting(key: string) {
  return useQuery({
    queryKey: ['settings', key],
    queryFn: () => unwrap(api.GET('/api/settings/{key}', { params: { path: { key } } })),
  })
}

export function useSetSetting(key: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (value: string) => unwrap(api.PUT('/api/settings/{key}', { params: { path: { key } }, body: { value } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings', key] }),
  })
}

export function useExclusionPresets() {
  return useQuery({
    queryKey: ['settings', 'exclusion-presets'],
    queryFn: () => unwrap(api.GET('/api/settings/exclusion-presets/available')),
    staleTime: Infinity,
  })
}
