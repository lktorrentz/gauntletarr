import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

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

export function useLibraryDuplicates(diskId?: number) {
  return useQuery({
    queryKey: ['library', 'duplicates', diskId],
    queryFn: () => unwrap(api.GET('/api/library/duplicates', { params: { query: { disk_id: diskId } } })),
  })
}

export function useItemDetail(contentType: string | null, tmdbId: number | null) {
  return useQuery({
    queryKey: ['library', 'detail', contentType, tmdbId],
    enabled: contentType != null && tmdbId != null,
    queryFn: () =>
      unwrap(
        api.GET('/api/library/items/{content_type}/{tmdb_id}', {
          params: { path: { content_type: contentType as string, tmdb_id: tmdbId as number } },
        }),
      ),
  })
}

export function useSearchNow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ contentType, tmdbId }: { contentType: string; tmdbId: number }) =>
      unwrap(
        api.POST('/api/library/items/{content_type}/{tmdb_id}/search', {
          params: { path: { content_type: contentType, tmdb_id: tmdbId } },
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] })
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
    },
  })
}

export function useExcludeFile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (relativePath: string) =>
      unwrap(api.POST('/api/library/exclude', { body: { relative_path: relativePath } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] })
      queryClient.invalidateQueries({ queryKey: ['settings', 'exclusion_patterns'] })
    },
  })
}
