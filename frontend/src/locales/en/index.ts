import { errors } from './errors'

// Ogni modulo di dominio esporta chiavi già namespaced (es. "errors.foo",
// "disks.title") — qui solo un merge piatto, mai nesting: t() resta un
// semplice lookup O(1) su un oggetto, senza dover camminare un albero.
export const en = {
  ...errors,
} as const

export type MessageKey = keyof typeof en
