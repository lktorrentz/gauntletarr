import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SettingField } from '@/components/SettingField'

export function IntegrationsSection() {
  return (
    <div className="grid max-w-xl gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Identificazione contenuto</CardTitle>
          <CardDescription>Usate dal resolver durante lo scan e dal wizard di upload.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <SettingField
            settingKey="tmdb_api_key"
            label="TMDB API key"
            description="https://www.themoviedb.org/settings/api"
            type="password"
          />
          <SettingField
            settingKey="tvdb_api_key"
            label="TVDB API key"
            description="https://thetvdb.com/api-information — opzionale, non ancora usata dal resolver."
            type="password"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Radarr</CardTitle>
          <CardDescription>Non ancora usata dal resolver — salvata per quando verrà collegata.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <SettingField settingKey="radarr_base_url" label="URL" description="http://radarr:7878" />
          <SettingField settingKey="radarr_api_key" label="API key" description="Impostazioni → Generale in Radarr" type="password" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sonarr</CardTitle>
          <CardDescription>Non ancora usata dal resolver — salvata per quando verrà collegata.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <SettingField settingKey="sonarr_base_url" label="URL" description="http://sonarr:8989" />
          <SettingField settingKey="sonarr_api_key" label="API key" description="Impostazioni → Generale in Sonarr" type="password" />
        </CardContent>
      </Card>
    </div>
  )
}
