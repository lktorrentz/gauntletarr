import { useMemo } from 'react'

import { useSetSetting, useSetting } from '@/api/hooks/settings'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { t } from '@/lib/i18n'

const DATE_FORMATS = ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY'] as const

// Le impostazioni si salvano davvero (stesso app_settings key/value di
// tmdb_api_key ecc.), ma per ora nessuna pagina le legge ancora per
// formattare le date che già mostra — vedi timeLanguage.notYetAppliedNote.
function SettingSelectField({
  settingKey,
  label,
  description,
  options,
  defaultValue,
}: {
  settingKey: string
  label: string
  description?: string
  options: { value: string; label: string }[]
  defaultValue: string
}) {
  const { data } = useSetting(settingKey)
  const setSetting = useSetSetting(settingKey)
  const value = data?.value || defaultValue

  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <Select value={value} onValueChange={(v) => setSetting.mutate(v)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function TimeLanguageSection() {
  const browserTimeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])
  const timeZones = useMemo(() => {
    const supported =
      'supportedValuesOf' in Intl ? Intl.supportedValuesOf('timeZone') : [browserTimeZone]
    return ['UTC', ...supported.filter((tz) => tz !== 'UTC')].sort((a, b) => (a === 'UTC' ? -1 : a.localeCompare(b)))
  }, [browserTimeZone])

  return (
    <div className="grid max-w-xl gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('timeLanguage.languageTitle')}</CardTitle>
          <CardDescription>{t('timeLanguage.languageDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value="en" disabled>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('timeLanguage.timeZoneTitle')}</CardTitle>
          <CardDescription>{t('timeLanguage.timeZoneDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <SettingSelectField
            settingKey="ui_timezone"
            label={t('timeLanguage.timeZoneTitle')}
            options={timeZones.map((tz) => ({ value: tz, label: tz }))}
            defaultValue={browserTimeZone}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <SettingSelectField
              settingKey="ui_date_format"
              label={t('timeLanguage.dateFormatTitle')}
              options={DATE_FORMATS.map((format) => ({ value: format, label: format }))}
              defaultValue="YYYY-MM-DD"
            />
            <SettingSelectField
              settingKey="ui_time_format"
              label={t('timeLanguage.timeFormatTitle')}
              options={[
                { value: '24h', label: t('timeLanguage.timeFormat24h') },
                { value: '12h', label: t('timeLanguage.timeFormat12h') },
              ]}
              defaultValue="24h"
            />
          </div>
          <p className="text-xs text-muted-foreground">{t('timeLanguage.notYetAppliedNote')}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('timeLanguage.sizeUnitsTitle')}</CardTitle>
          <CardDescription>{t('timeLanguage.sizeUnitsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingSelectField
            settingKey="size_units"
            label={t('timeLanguage.sizeUnitsTitle')}
            options={[
              { value: 'decimal', label: t('timeLanguage.sizeUnitsDecimal') },
              { value: 'binary', label: t('timeLanguage.sizeUnitsBinary') },
            ]}
            defaultValue="decimal"
          />
        </CardContent>
      </Card>
    </div>
  )
}
