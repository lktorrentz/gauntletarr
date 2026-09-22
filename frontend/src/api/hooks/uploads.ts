import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'
import type { Schemas } from '@/api/client'

export function useUploads() {
  return useQuery({
    queryKey: ['uploads'],
    queryFn: () => unwrap(api.GET('/api/uploads')),
  })
}

export function useUpload(uploadId: number | null) {
  return useQuery({
    queryKey: ['uploads', uploadId],
    queryFn: () => unwrap(api.GET('/api/uploads/{upload_id}', { params: { path: { upload_id: uploadId! } } })),
    enabled: uploadId !== null,
  })
}

export function useCreateUpload() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: Schemas['UploadCreateRequest']) => unwrap(api.POST('/api/uploads', { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['uploads'] }),
  })
}

export function usePrepareUpload() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (uploadId: number) =>
      unwrap(api.POST('/api/uploads/{upload_id}/prepare', { params: { path: { upload_id: uploadId } } })),
    onSuccess: (_, uploadId) => queryClient.invalidateQueries({ queryKey: ['uploads', uploadId] }),
  })
}

export function usePatchUpload() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ uploadId, body }: { uploadId: number; body: Schemas['UploadPatchRequest'] }) =>
      unwrap(api.PATCH('/api/uploads/{upload_id}', { params: { path: { upload_id: uploadId } }, body })),
    onSuccess: (_, { uploadId }) => queryClient.invalidateQueries({ queryKey: ['uploads', uploadId] }),
  })
}

export function useDupeCheck(uploadId: number | null) {
  return useQuery({
    queryKey: ['uploads', uploadId, 'dupe-check'],
    queryFn: () =>
      unwrap(api.GET('/api/uploads/{upload_id}/dupe-check', { params: { path: { upload_id: uploadId! } } })),
    // Manuale (refetch()), non al mount: è una vera chiamata di rete verso
    // il tracker (docs/SPEC.md §9 passo 7), mai innescata implicitamente
    // solo perché la pagina si è (ri)renderizzata.
    enabled: false,
    // Un 400 (es. tmdb_id non ancora impostato) non si risolve ritentando
    // — di default TanStack Query ritenterebbe comunque 3 volte, lasciando
    // il pulsante bloccato su "in corso" più a lungo del necessario.
    retry: false,
  })
}

export function useConfirmUpload() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ uploadId, torrentClientId }: { uploadId: number; torrentClientId: number }) =>
      unwrap(
        api.POST('/api/uploads/{upload_id}/confirm', {
          params: { path: { upload_id: uploadId } },
          body: { torrent_client_id: torrentClientId },
        }),
      ),
    onSuccess: (_, { uploadId }) => {
      queryClient.invalidateQueries({ queryKey: ['uploads', uploadId] })
      queryClient.invalidateQueries({ queryKey: ['uploads'] })
    },
  })
}
