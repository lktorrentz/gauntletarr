import { useQuery } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'

export function useLibraryItems(diskId?: number) {
  return useQuery({
    queryKey: ['library', 'items', diskId],
    queryFn: () => unwrap(api.GET('/api/library/items', { params: { query: { disk_id: diskId } } })),
  })
}

export function useMediaFiles(diskId?: number) {
  return useQuery({
    queryKey: ['library', 'media-files', diskId],
    queryFn: () => unwrap(api.GET('/api/media-files', { params: { query: { disk_id: diskId } } })),
  })
}

export function useSeedFiles(diskId?: number) {
  return useQuery({
    queryKey: ['library', 'seed-files', diskId],
    queryFn: () => unwrap(api.GET('/api/seed-files', { params: { query: { disk_id: diskId } } })),
  })
}

export function useUnmatched(diskId?: number) {
  return useQuery({
    queryKey: ['library', 'unmatched', diskId],
    queryFn: () => unwrap(api.GET('/api/library/unmatched', { params: { query: { disk_id: diskId } } })),
  })
}
