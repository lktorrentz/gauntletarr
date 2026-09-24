import { pushActivity } from '@/lib/activity'
import { t } from '@/lib/i18n'

// Le impostazioni che si salvano al solo cambiamento (switch, select,
// riordini) non hanno un pulsante Save che confermi: ogni salvataggio lo
// dice con una notifica nello stesso stack delle altre azioni. `what` dice
// cosa è cambiato, es. "MyTracker · Enabled".
export function autosaveFeedback(what: string) {
  return {
    onSuccess: () => pushActivity({ status: 'success', title: t('activity.saved'), detail: what }),
    onError: (error: Error) =>
      pushActivity({ status: 'error', title: t('activity.saveFailed'), detail: `${what}: ${error.message}` }),
  }
}
