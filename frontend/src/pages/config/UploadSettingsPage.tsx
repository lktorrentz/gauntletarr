import { useState } from 'react'
import { toast } from 'sonner'

import { useSetSetting, useSetting } from '@/api/hooks/settings'
import { SettingField } from '@/components/SettingField'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ImageHostPriorityField } from '@/pages/config/ImageHostPriorityField'

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
    <div className="grid gap-6">
      <Card className="max-w-xl">
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

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Descrizione</CardTitle>
        </CardHeader>
        <CardContent>
          <DescriptionHeaderField />
        </CardContent>
      </Card>

      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>Host immagini</CardTitle>
          <CardDescription>
            Priorità e stato a sinistra, chiavi API a destra — si prova il primo host abilitato, se fallisce si
            passa al successivo. Imgbox e Pixhost non ne richiedono.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <ImageHostPriorityField />
          <div className="grid gap-2">
            <SettingField compact settingKey="image_host_ptpimg_api_key" label="PTPImg" description="https://ptpimg.me" type="password" />
            <SettingField compact settingKey="image_host_imgbb_api_key" label="ImgBB" description="https://api.imgbb.com" type="password" />
            <SettingField compact settingKey="image_host_lensdump_api_key" label="Lensdump" description="https://lensdump.com" type="password" />
            <SettingField compact settingKey="image_host_ptscreens_api_key" label="PTScreens" description="https://ptscreens.com" type="password" />
            <SettingField compact settingKey="image_host_onlyimage_api_key" label="OnlyImage" description="https://onlyimage.org" type="password" />
            <SettingField compact settingKey="image_host_dalexni_api_key" label="Dalexni" description="https://dalexni.com" type="password" />
            <SettingField compact settingKey="image_host_utppm_api_key" label="utp.pm" description="https://utp.pm" type="password" />
            <SettingField compact settingKey="image_host_seedpool_cdn_api_key" label="Seedpool CDN" description="https://i.seedpool.org" type="password" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
