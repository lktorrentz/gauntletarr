import { useState } from 'react'
import { toast } from 'sonner'

import {
  useBundledUploadProfiles,
  useCreateUploadProfile,
  useDeleteUploadProfile,
  useUpdateUploadProfile,
  useUploadProfile,
} from '@/api/hooks/trackers'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

function jsonField(value: Record<string, number>) {
  return JSON.stringify(value, null, 2)
}

export function UploadProfileDialog({
  trackerId,
  trackerLabel,
  open,
  onOpenChange,
}: {
  trackerId: number
  trackerLabel: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: profile, isPending } = useUploadProfile(trackerId)
  const { data: bundled } = useBundledUploadProfiles()
  const createProfile = useCreateUploadProfile(trackerId)
  const updateProfile = useUpdateUploadProfile(trackerId)
  const deleteProfile = useDeleteUploadProfile(trackerId)

  // null = l'utente non ha ancora modificato il campo in questa sessione
  // del dialog: mostra il valore caricato dal profilo. Evita di
  // sincronizzare profile->stato locale con un effect (derivabile
  // direttamente durante il render).
  const [categoryMapDraft, setCategoryMapDraft] = useState<string | null>(null)
  const [typeMapDraft, setTypeMapDraft] = useState<string | null>(null)
  const [resolutionMapDraft, setResolutionMapDraft] = useState<string | null>(null)
  const [descriptionTemplateDraft, setDescriptionTemplateDraft] = useState<string | null>(null)
  const [bundledKey, setBundledKey] = useState('')

  const categoryMap = categoryMapDraft ?? (profile ? jsonField(profile.category_id_map) : '{}')
  const typeMap = typeMapDraft ?? (profile ? jsonField(profile.type_id_map) : '{}')
  const resolutionMap = resolutionMapDraft ?? (profile ? jsonField(profile.resolution_id_map) : '{}')
  const descriptionTemplate = descriptionTemplateDraft ?? profile?.description_template ?? ''

  function parseOrToast(label: string, raw: string): Record<string, number> | null {
    try {
      return JSON.parse(raw) as Record<string, number>
    } catch {
      toast.error(`${label} non è JSON valido`)
      return null
    }
  }

  function save() {
    const category_id_map = parseOrToast('category_id_map', categoryMap)
    const type_id_map = parseOrToast('type_id_map', typeMap)
    const resolution_id_map = parseOrToast('resolution_id_map', resolutionMap)
    if (!category_id_map || !type_id_map || !resolution_id_map) return
    updateProfile.mutate(
      { category_id_map, type_id_map, resolution_id_map, description_template: descriptionTemplate },
      {
        onSuccess: () => {
          setCategoryMapDraft(null)
          setTypeMapDraft(null)
          setResolutionMapDraft(null)
          setDescriptionTemplateDraft(null)
        },
        onError: (error) => toast.error(`Salvataggio fallito: ${error.message}`),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Profilo di upload — {trackerLabel}</DialogTitle>
        </DialogHeader>

        {isPending && <p className="text-sm text-muted-foreground">Caricamento…</p>}

        {!isPending && !profile && (
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              Questo tracker non fa ancora upload. Parti da un profilo bundlato o creane uno vuoto.
            </p>
            <div className="flex items-center gap-2">
              <Select value={bundledKey} onValueChange={setBundledKey}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Profilo bundlato…" />
                </SelectTrigger>
                <SelectContent>
                  {bundled?.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button disabled={!bundledKey} onClick={() => createProfile.mutate({ profile_key: bundledKey })}>
                Usa profilo
              </Button>
            </div>
            <Button variant="outline" onClick={() => createProfile.mutate({ profile_key: null })}>
              Profilo custom vuoto
            </Button>
          </div>
        )}

        {!isPending && profile && (
          <div className="grid gap-3">
            {profile.source_profile_key && (
              <p className="text-xs text-muted-foreground">
                Copiato dal profilo bundlato "{profile.source_profile_key}" — riverifica gli id contro il tuo account
                prima del primo upload reale.
              </p>
            )}
            <div className="grid gap-1.5">
              <Label>category_id_map</Label>
              <Textarea rows={3} className="font-mono text-xs" value={categoryMap} onChange={(e) => setCategoryMapDraft(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>type_id_map</Label>
              <Textarea rows={5} className="font-mono text-xs" value={typeMap} onChange={(e) => setTypeMapDraft(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>resolution_id_map</Label>
              <Textarea rows={5} className="font-mono text-xs" value={resolutionMap} onChange={(e) => setResolutionMapDraft(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Template descrizione (Jinja2)</Label>
              <Textarea
                rows={4}
                className="font-mono text-xs"
                value={descriptionTemplate}
                onChange={(e) => setDescriptionTemplateDraft(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="up-anon">Anonymous di default</Label>
              <Switch
                id="up-anon"
                checked={profile.default_anonymous}
                onCheckedChange={(v) => updateProfile.mutate({ default_anonymous: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="up-personal">Personal release di default</Label>
              <Switch
                id="up-personal"
                checked={profile.default_personal_release}
                onCheckedChange={(v) => updateProfile.mutate({ default_personal_release: v })}
              />
            </div>
            <div className="flex justify-between">
              <Button variant="destructive" onClick={() => deleteProfile.mutate()}>
                Elimina profilo
              </Button>
              <Button onClick={save} disabled={updateProfile.isPending}>
                Salva
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
