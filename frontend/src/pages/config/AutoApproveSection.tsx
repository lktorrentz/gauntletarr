
import { useSetSetting, useSetting } from '@/api/hooks/settings'
import { SettingField } from '@/components/SettingField'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { t } from '@/lib/i18n'
import { autosaveFeedback } from '@/lib/autosave'

// Spenta di default (app/review.py auto_execute_enabled): decisione
// dell'utente, niente che modifichi file o client parte senza la sua
// approvazione. Accesa solo con una scelta esplicita qui.
const AUTO_EXECUTE_KEY = 'auto_execute_above_threshold'
// Attiva di default (app/review.py verify_before_execute_enabled): mai
// salvata = attiva.
const VERIFY_KEY = 'verify_before_execute'

function VerifySwitch() {
  const { data } = useSetting(VERIFY_KEY)
  const setSetting = useSetSetting(VERIFY_KEY)
  const enabled = (data?.value ?? 'true').toLowerCase() !== 'false'
  return (
    <div className="flex items-start gap-3 border-t pt-4">
      <Switch
        id="verify-before-execute"
        checked={enabled}
        disabled={setSetting.isPending}
        onCheckedChange={(on) => setSetting.mutate(on ? 'true' : 'false', autosaveFeedback(t('integrations.verifyLabel')))}
        className="mt-0.5"
      />
      <div className="grid gap-1">
        <Label htmlFor="verify-before-execute">{t('integrations.verifyLabel')}</Label>
        <p className="text-xs text-muted-foreground">{t('integrations.verifyHelp')}</p>
      </div>
    </div>
  )
}

function AutoExecuteSwitch() {
  const { data } = useSetting(AUTO_EXECUTE_KEY)
  const setSetting = useSetSetting(AUTO_EXECUTE_KEY)
  const enabled = (data?.value ?? '').toLowerCase() === 'true'
  return (
    <div className="flex items-start gap-3 border-t pt-4">
      <Switch
        id="auto-execute"
        checked={enabled}
        disabled={setSetting.isPending}
        onCheckedChange={(on) =>
          setSetting.mutate(on ? 'true' : 'false', autosaveFeedback(t('integrations.autoExecuteLabel')))
        }
        className="mt-0.5"
      />
      <div className="grid gap-1">
        <Label htmlFor="auto-execute">{t('integrations.autoExecuteLabel')}</Label>
        <p className="text-xs text-muted-foreground">{t('integrations.autoExecuteHelp')}</p>
      </div>
    </div>
  )
}

export function AutoApproveSection() {
  return (
    <div className="grid max-w-xl gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('integrations.autoApproveThresholdsTitle')}</CardTitle>
          <CardDescription>{t('integrations.autoApproveThresholdsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <SettingField
            settingKey="confidence_threshold_auto_media_to_torrent"
            label="media → torrent"
            description="Default: 0.95"
            type="number"
            placeholder="0.95"
          />
          <SettingField
            settingKey="confidence_threshold_auto_torrent_to_client"
            label="torrent → client"
            description="Default: 0.98"
            type="number"
            placeholder="0.98"
          />
          <VerifySwitch />
          <AutoExecuteSwitch />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('integrations.rematchTitle')}</CardTitle>
          <CardDescription>{t('integrations.rematchDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingField
            settingKey="rematch_interval_days"
            label={t('integrations.rematchLabel')}
            description={t('integrations.rematchHelp')}
            type="number"
            placeholder="7"
          />
        </CardContent>
      </Card>
    </div>
  )
}
