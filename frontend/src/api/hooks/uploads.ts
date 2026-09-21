import { useQuery } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'

// Solo la query di lista per ora (usata dal riepilogo in Dashboard) — le
// mutation (crea/prepara/conferma) arrivano con la Sotto-fase 8.5 (wizard
// di upload), vedi il piano della Fase 8.
export function useUploads() {
  return useQuery({
    queryKey: ['uploads'],
    queryFn: () => unwrap(api.GET('/api/uploads')),
  })
}
