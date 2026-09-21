import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'
import type { Schemas } from '@/api/client'

export function useDisks() {
  return useQuery({
    queryKey: ['disks'],
    queryFn: () => unwrap(api.GET('/api/disks')),
  })
}

export function useAvailableMounts() {
  return useQuery({
    queryKey: ['disks', 'available-mounts'],
    queryFn: () => unwrap(api.GET('/api/disks/available-mounts')),
  })
}

export function useCreateDisk() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: Schemas['DiskCreateRequest']) => unwrap(api.POST('/api/disks', { body })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disks'] })
    },
  })
}

export function useUpdateDisk() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ diskId, body }: { diskId: number; body: Schemas['DiskUpdateRequest'] }) =>
      unwrap(api.PATCH('/api/disks/{disk_id}', { params: { path: { disk_id: diskId } }, body })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disks'] })
    },
  })
}

export function useDeleteDisk() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (diskId: number) => unwrap(api.DELETE('/api/disks/{disk_id}', { params: { path: { disk_id: diskId } } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disks'] })
    },
  })
}

export function useVerifyDisk() {
  return useMutation({
    mutationFn: (diskId: number) => unwrap(api.POST('/api/disks/{disk_id}/verify', { params: { path: { disk_id: diskId } } })),
  })
}

export function useBrowseDisk(diskId: number | null, path: string) {
  return useQuery({
    queryKey: ['disks', diskId, 'browse', path],
    queryFn: () =>
      unwrap(
        api.GET('/api/disks/{disk_id}/browse', {
          params: { path: { disk_id: diskId! }, query: { path } },
        }),
      ),
    enabled: diskId !== null,
  })
}

export function useMkdir(diskId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (path: string) =>
      unwrap(api.POST('/api/disks/{disk_id}/mkdir', { params: { path: { disk_id: diskId } }, body: { path } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disks', diskId, 'browse'] })
    },
  })
}

export function useMediaPaths(diskId: number) {
  return useQuery({
    queryKey: ['disks', diskId, 'media-paths'],
    queryFn: () => unwrap(api.GET('/api/disks/{disk_id}/media-paths', { params: { path: { disk_id: diskId } } })),
  })
}

export function useCreateMediaPath(diskId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: Schemas['MediaPathCreateRequest']) =>
      unwrap(api.POST('/api/disks/{disk_id}/media-paths', { params: { path: { disk_id: diskId } }, body })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disks', diskId, 'media-paths'] })
    },
  })
}

export function useUpdateMediaPath(diskId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ mediaPathId, body }: { mediaPathId: number; body: Schemas['MediaPathUpdateRequest'] }) =>
      unwrap(
        api.PATCH('/api/media-paths/{media_path_id}', {
          params: { path: { media_path_id: mediaPathId } },
          body,
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disks', diskId, 'media-paths'] })
    },
  })
}

export function useDeleteMediaPath(diskId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (mediaPathId: number) =>
      unwrap(api.DELETE('/api/media-paths/{media_path_id}', { params: { path: { media_path_id: mediaPathId } } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disks', diskId, 'media-paths'] })
    },
  })
}
