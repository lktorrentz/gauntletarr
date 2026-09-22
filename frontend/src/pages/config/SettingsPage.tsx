import { SettingField } from '@/components/SettingField'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function SettingsPage() {
  return (
    <div className="grid max-w-xl gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Soglie di auto-approvazione</CardTitle>
          <CardDescription>
            Confidence minima (0.0-1.0) sopra la quale un match viene eseguito automaticamente, per direzione.
          </CardDescription>
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
