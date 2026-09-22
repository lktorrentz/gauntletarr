import { useState } from 'react'
import { toast } from 'sonner'

import { useSetSetting, useSetting } from '@/api/hooks/settings'
import { SettingField } from '@/components/SettingField'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

function TonemapSwitch() {
  const { data } = useSetting('upload_tonemap_hdr')
  const setSetting = useSetSetting('upload_tonemap_hdr')
  const checked = data?.value === 'true'

  return (
    <div className="flex items-center justify-between">
      <div className="grid gap-0.5">
        <Label htmlFor="upload-tonemap">Tonemap HDR negli screenshot</Label>
        <p className="text-xs text-muted-foreground">
          Converte HDR→SDR (algoritmo mobius) prima di catturare gli screenshot — senza, una sorgente HDR risulta
          lavata/scura una volta interpretata come SDR.
        </p>
      </div>
      <Switch
        id="upload-tonemap"
        checked={checked}
        onCheckedChange={(v) => setSetting.mutate(v ? 'true' : 'false')}
      />
    </div>
  )
}

function DescriptionHeaderField() {
  const { data } = useSetting('upload_description_header')
  const setSetting = useSetSetting('upload_description_header')
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? data?.value ?? ''

  return (
    <div className="grid gap-1.5">
      <Label>Intestazione descrizione</Label>
      <p className="text-xs text-muted-foreground">
        Testo (es. BBCode) anteposto alla descrizione generata dal template del tracker — vuoto per non aggiungere
        nulla.
      </p>
      <Textarea rows={3} className="font-mono text-xs" value={value} onChange={(e) => setDraft(e.target.value)} />
      <button
        type="button"
        className="w-fit text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        onClick={() =>
          setSetting.mutate(value, {
            onSuccess: () => {
              toast.success('Intestazione salvata.')
              setDraft(null)
            },
            onError: (error) => toast.error(`Salvataggio fallito: ${error.message}`),
          })
        }
      >
        Salva intestazione
      </button>
    </div>
  )
}

export function UploadSettingsPage() {
  return (
    <div className="grid max-w-xl gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Screenshot</CardTitle>
          <CardDescription>Applicate al prossimo upload preparato, non retroattive su quelli già pronti.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <SettingField
            settingKey="upload_screenshot_count"
            label="Numero di screenshot"
            description="Frame equidistanti, esclude il primo/ultimo 5% della durata."
            type="number"
            placeholder="4"
          />
          <TonemapSwitch />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Descrizione</CardTitle>
        </CardHeader>
        <CardContent>
          <DescriptionHeaderField />
        </CardContent>
      </Card>
    </div>
  )
}
