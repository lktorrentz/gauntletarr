import { SettingField } from '@/components/SettingField'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ImageHostPriorityField } from '@/pages/config/ImageHostPriorityField'

export function SettingsPage() {
  return (
    <div className="grid gap-6">
      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>Host immagini (upload)</CardTitle>
          <CardDescription>
            Priorità e stato a sinistra, chiavi API a destra — Imgbox e Pixhost non ne richiedono.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <ImageHostPriorityField />
          <div className="grid gap-4">
            <SettingField
              settingKey="image_host_ptpimg_api_key"
              label="PTPImg API key"
              description="https://ptpimg.me"
              type="password"
            />
            <SettingField
              settingKey="image_host_imgbb_api_key"
              label="ImgBB API key"
              description="https://api.imgbb.com"
              type="password"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-xl">
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
