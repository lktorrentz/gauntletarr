import createClient from 'openapi-fetch'

import type { paths } from './schema'

// baseUrl vuota: le path dello schema OpenAPI includono già il prefisso
// /api di FastAPI (es. "/api/disks") - risolte relative all'origine
// corrente, così il proxy di Vite (vite.config.ts, solo dev) e il mount
// statico di FastAPI (produzione, stesso container) funzionano identici
// senza bisogno di CORS.
export const api = createClient<paths>({ baseUrl: '' })
