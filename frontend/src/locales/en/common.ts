// Vocabolario condiviso — azioni/stati generici ripetuti identici in
// decine di componenti (Salva/Elimina/Modifica/Caricamento…). Un dialog o
// una card specifica usa queste chiavi invece di re-imporre una propria
// traduzione locale della stessa parola.
export const common = {
  'common.save': 'Save',
  'common.saved': 'Saved.',
  'common.itemSaved': '{item} saved.',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.cancel': 'Cancel',
  'common.loading': 'Loading…',
  'common.saveFailed': 'Save failed: {message}',
  'common.leaveBlank': 'Leave blank to keep it unchanged',
  'common.runNow': 'Run now',
  'common.runFailed': 'Run failed: {message}',
} as const
