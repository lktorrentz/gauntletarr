import { useState } from 'react'
import { toast } from 'sonner'

import { useSetSetting, useSetting } from '@/api/hooks/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function SettingField({
  settingKey,
  label,
  description,
  type = 'text',
  placeholder,
  compact = false,
}: {
  settingKey: string
  label: string
  description: string
  type?: 'text' | 'password' | 'number'
  placeholder?: string
  // Una riga sola (nome + input + Salva) invece di etichetta/descrizione
  // impilate sopra — per liste lunghe (es. le chiavi API dei provider
  // immagine) dove lo spazio verticale conta più della descrizione estesa.
  compact?: boolean
}) {
  const { data, isPending } = useSetting(settingKey)
  const setSetting = useSetSetting(settingKey)
  // null = l'utente non ha ancora toccato il campo: mostra il valore dal
  // server. Evita di sincronizzare data->stato locale con un effect (mai
  // necessario qui, derivabile direttamente durante il render).
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? data?.value ?? ''

  function save() {
    setSetting.mutate(value, {
      onSuccess: () => {
        toast.success(`${label} salvato.`)
        setDraft(null)
      },
      onError: (error) => toast.error(`Salvataggio fallito: ${error.message}`),
    })
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Label htmlFor={settingKey} title={description} className="w-28 shrink-0 truncate text-xs">
          {label}
        </Label>
        <Input
          id={settingKey}
          type={type}
          value={value}
          placeholder={isPending ? 'Caricamento…' : placeholder}
          onChange={(e) => setDraft(e.target.value)}
          className="h-8"
        />
        <Button variant="outline" size="sm" disabled={setSetting.isPending} onClick={save}>
          Salva
        </Button>
      </div>
    )
  }

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
        <Button variant="outline" disabled={setSetting.isPending} onClick={save}>
          Salva
        </Button>
      </div>
    </div>
  )
}
