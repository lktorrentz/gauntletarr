import createClient from 'openapi-fetch'
import type { FetchResponse } from 'openapi-fetch'
import type { MediaType } from 'openapi-typescript-helpers'

import type { components, paths } from './schema'

export type Schemas = components['schemas']

// baseUrl vuota: le path dello schema OpenAPI includono già il prefisso
// /api di FastAPI (es. "/api/disks") - risolte relative all'origine
// corrente, così il proxy di Vite (vite.config.ts, solo dev) e il mount
// statico di FastAPI (produzione, stesso container) funzionano identici
// senza bisogno di CORS.
export const api = createClient<paths>({ baseUrl: '' })

/**
 * Estrae `data` da una risposta openapi-fetch, o lancia un Error col
 * messaggio di FastAPI (`{"detail": "..."}`) se la richiesta è fallita —
 * così ogni mutation può semplicemente fare `await unwrap(api.POST(...))`
 * e lasciare che TanStack Query gestisca l'errore, senza ripetere questo
 * controllo in ogni hook. Tipizzato esattamente come il valore di ritorno
 * di api.GET/POST/... (FetchResponse di openapi-fetch), non una forma
 * scritta a mano — altrimenti TS non riesce a inferire T correttamente
 * (weak-type check su un'unione discriminata senza proprietà realmente
 * in comune tra i due rami).
 */
export async function unwrap<T extends Record<string | number, unknown>, O, M extends MediaType>(
  promise: Promise<FetchResponse<T, O, M>>,
): Promise<NonNullable<FetchResponse<T, O, M>['data']>> {
  const { data, error } = await promise
  if (error !== undefined) {
    const detail = (error as { detail?: unknown } | undefined)?.detail
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(error))
  }
  return data as NonNullable<typeof data>
}
