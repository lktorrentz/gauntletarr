import { useState } from 'react'
import { toast } from 'sonner'

import { useSetSetting, useSetting } from '@/api/hooks/settings'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function SettingField({
  settingKey,
  label,
  description,
  type = 'text',
  placeholder,
}: {
  settingKey: string
  label: string
  description: string
  type?: 'text' | 'password' | 'number'
  placeholder?: string
}) {
  const { data, isPending } = useSetting(settingKey)
  const setSetting = useSetSetting(settingKey)
  // null = l'utente non ha ancora toccato il campo: mostra il valore dal
  // server. Evita di sincronizzare data->stato locale con un effect (mai
  // necessario qui, derivabile direttamente durante il render).
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? data?.value ?? ''

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={settingKey}>{label}</Label>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="flex items-center gap-2">
        <Input
          id={settingKey}
          type={type}
          value={value}
          placeholder={isPending ? 'Caricamento…' : placeholder}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button
          variant="outline"
          disabled={setSetting.isPending}
          onClick={() =>
            setSetting.mutate(value, {
              onSuccess: () => {
                toast.success(`${label} salvato.`)
                setDraft(null)
              },
              onError: (error) => toast.error(`Salvataggio fallito: ${error.message}`),
            })
          }
        >
          Salva
        </Button>
      </div>
    </div>
  )
}

export function SettingsPage() {
  return (
    <div className="grid max-w-xl gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Identificazione contenuto</CardTitle>
          <CardDescription>Necessaria per la risoluzione TMDB durante lo scan.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingField
            settingKey="tmdb_api_key"
            label="TMDB API key"
            description="https://www.themoviedb.org/settings/api"
            type="password"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Host immagini (upload)</CardTitle>
          <CardDescription>
            Ordine di priorità e chiavi per gli screenshot di upload (docs/SPEC.md §9). Imgbox non richiede una
            chiave.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <SettingField
            settingKey="image_host_priority"
            label="Ordine di priorità"
            description="CSV, es. ptpimg,imgbox,imgbb — default se vuoto: ptpimg,imgbox,imgbb"
            placeholder="ptpimg,imgbox,imgbb"
          />
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Soglie di auto-approvazione</CardTitle>
          <CardDescription>
            Confidence minima (0.0-1.0) sopra la quale un match viene eseguito automaticamente, per direzione
            (docs/SPEC.md §8).
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
