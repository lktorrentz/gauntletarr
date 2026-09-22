import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SettingField } from '@/components/SettingField'
import { t } from '@/lib/i18n'

export function IntegrationsSection() {
  return (
    <div className="grid max-w-xl gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('integrations.contentIdTitle')}</CardTitle>
          <CardDescription>{t('integrations.contentIdDescription')}</CardDescription>
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
            description={t('integrations.tvdbApiKeyDescription')}
            type="password"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Radarr</CardTitle>
          <CardDescription>{t('integrations.notYetUsedDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <SettingField settingKey="radarr_base_url" label="URL" description="http://radarr:7878" />
          <SettingField
            settingKey="radarr_api_key"
            label="API key"
            description={t('integrations.radarrApiKeyDescription')}
            type="password"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sonarr</CardTitle>
          <CardDescription>{t('integrations.notYetUsedDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <SettingField settingKey="sonarr_base_url" label="URL" description="http://sonarr:8989" />
          <SettingField
            settingKey="sonarr_api_key"
            label="API key"
            description={t('integrations.sonarrApiKeyDescription')}
            type="password"
          />
        </CardContent>
      </Card>
    </div>
  )
}
