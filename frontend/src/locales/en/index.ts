import { application } from './application'
import { auth } from './auth'
import { common } from './common'
import { dashboard } from './dashboard'
import { disks } from './disks'
import { errors } from './errors'
import { integrations } from './integrations'
import { layout } from './layout'
import { library } from './library'
import { logs } from './logs'
import { reseeding } from './reseeding'
import { security } from './security'
import { torrent } from './torrent'
import { torrentClients } from './torrentClients'
import { trackers } from './trackers'
import { upload } from './upload'
import { uploadSettings } from './uploadSettings'

// Ogni modulo di dominio esporta chiavi già namespaced (es. "errors.foo",
// "disks.title") — qui solo un merge piatto, mai nesting: t() resta un
// semplice lookup O(1) su un oggetto, senza dover camminare un albero.
export const en = {
  ...application,
  ...auth,
  ...common,
  ...dashboard,
  ...disks,
  ...errors,
  ...integrations,
  ...layout,
  ...library,
  ...logs,
  ...reseeding,
  ...security,
  ...torrent,
  ...torrentClients,
  ...trackers,
  ...upload,
  ...uploadSettings,
} as const

export type MessageKey = keyof typeof en
