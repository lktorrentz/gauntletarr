import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SettingField } from '@/components/SettingField'
import { t } from '@/lib/i18n'

export function MetadataSection() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t('metadata.tmdbTitle')}</CardTitle>
          <CardDescription>{t('metadata.tmdbDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingField
            settingKey="tmdb_api_key"
            label={t('metadata.apiKey')}
            description={t('metadata.tmdbApiKeyDescription')}
            type="password"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('metadata.tvdbTitle')}</CardTitle>
          <CardDescription>{t('metadata.tvdbDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingField
            settingKey="tvdb_api_key"
            label={t('metadata.apiKey')}
            description={t('metadata.tvdbApiKeyDescription')}
            type="password"
          />
        </CardContent>
      </Card>
    </div>
  )
}
