import { SettingField } from '@/components/SettingField'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { t } from '@/lib/i18n'

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
        </CardContent>
      </Card>
    </div>
  )
}
