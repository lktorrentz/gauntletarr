// Controlli completi degli hash partiti da un'approvazione (verify_before_execute):
// quale notifica aggiorna ciascuno. Lo usa il watcher in ActivityStack, che
// interroga /api/full-checks finché uno è in corso.
const tracked = new Map<string, string>() // check id -> activity id

export function trackVerification(checkId: string, activityId: string) {
  tracked.set(checkId, activityId)
}

export function activityForCheck(checkId: string): string | undefined {
  return tracked.get(checkId)
}

export function untrackVerification(checkId: string) {
  tracked.delete(checkId)
}

export function hasTrackedVerifications(): boolean {
  return tracked.size > 0
}
