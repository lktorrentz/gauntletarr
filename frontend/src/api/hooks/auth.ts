import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'
import type { Schemas } from '@/api/client'
import { clearPersistedQueries } from '@/lib/queryPersistence'
import { clearToken, setToken } from '@/lib/authToken'

export function useAuthStatus() {
  return useQuery({
    queryKey: ['auth', 'status'],
    queryFn: () => unwrap(api.GET('/api/auth/status')),
  })
}

export function useMe(enabled: boolean) {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => unwrap(api.GET('/api/auth/me')),
    enabled,
    retry: false,
  })
}

export function useSetup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: Schemas['SetupRequest']) => unwrap(api.POST('/api/auth/setup', { body })),
    onSuccess: (data) => {
      setToken(data.access_token)
      queryClient.invalidateQueries({ queryKey: ['auth'] })
    },
  })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: Schemas['LoginRequest']) => unwrap(api.POST('/api/auth/login', { body })),
    onSuccess: (data) => {
      setToken(data.access_token)
      queryClient.invalidateQueries({ queryKey: ['auth'] })
    },
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: Schemas['ChangePasswordRequest']) => unwrap(api.POST('/api/auth/change-password', { body })),
  })
}

export function logout(queryClient: ReturnType<typeof useQueryClient>) {
  clearToken()
  // I dati della libreria salvati nel browser (IndexedDB) non devono restare
  // leggibili da chi usa lo stesso browser dopo il logout.
  queryClient.removeQueries({ queryKey: ['library'] })
  void clearPersistedQueries()
  queryClient.invalidateQueries({ queryKey: ['auth'] })
}
