import type { UseMutationResult } from '@tanstack/react-query'
import { PencilIcon, PlusIcon, TrashIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import {
  useCreateRadarrInstance,
  useCreateSonarrInstance,
  useDeleteRadarrInstance,
  useDeleteSonarrInstance,
  useRadarrInstances,
  useSonarrInstances,
  useUpdateRadarrInstance,
  useUpdateSonarrInstance,
} from '@/api/hooks/arrInstances'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { t } from '@/lib/i18n'

// Radarr e Sonarr non sono ancora consumati da nessun adapter (nessun
// resolver li chiama davvero) — ma la tabella è già multi-istanza da
// subito, stesso pattern di Tracker/TorrentClient, per evitare una
// migrazione dolorosa quando arriverà l'adapter vero.
interface ArrInstance {
  id: number
  label: string
  base_url: string
  enabled: boolean
}

interface ArrInstanceWriteBody {
  label: string
  base_url: string
  api_key: string
}

interface ArrInstanceUpdateBody {
  label?: string
  base_url?: string
  api_key?: string
  enabled?: boolean
}

function AddArrInstanceDialog({
  urlPlaceholder,
  createMutation,
}: {
  urlPlaceholder: string
  createMutation: UseMutationResult<ArrInstance, Error, ArrInstanceWriteBody>
}) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')

  function reset() {
    setLabel('')
    setBaseUrl('')
    setApiKey('')
  }

  function submit() {
    createMutation.mutate(
      { label, base_url: baseUrl, api_key: apiKey },
      {
        onSuccess: () => {
          setOpen(false)
          reset()
        },
        onError: (error) => toast.error(t('integrations.createInstanceFailed', { message: error.message })),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <PlusIcon className="size-4" />
            {t('integrations.addInstance')}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('integrations.addInstance')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="arr-add-label">{t('integrations.instanceLabel')}</Label>
            <Input id="arr-add-label" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="arr-add-url">{t('integrations.instanceUrl')}</Label>
            <Input
              id="arr-add-url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={urlPlaceholder}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="arr-add-key">{t('integrations.instanceApiKey')}</Label>
            <Input id="arr-add-key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={!label || !baseUrl || !apiKey || createMutation.isPending}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditArrInstanceDialog({
  instance,
  updateMutation,
}: {
  instance: ArrInstance
  updateMutation: UseMutationResult<ArrInstance, Error, { id: number; body: ArrInstanceUpdateBody }>
}) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState(instance.label)
  const [baseUrl, setBaseUrl] = useState(instance.base_url)
  const [apiKey, setApiKey] = useState('')

  function submit() {
    updateMutation.mutate(
      { id: instance.id, body: { label, base_url: baseUrl, api_key: apiKey || undefined } },
      {
        onSuccess: () => {
          setOpen(false)
          setApiKey('')
        },
        onError: (error) => toast.error(t('common.saveFailed', { message: error.message })),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" title={t('common.edit')}>
            <PencilIcon className="size-4" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('integrations.editInstance')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="arr-edit-label">{t('integrations.instanceLabel')}</Label>
            <Input id="arr-edit-label" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="arr-edit-url">{t('integrations.instanceUrl')}</Label>
            <Input id="arr-edit-url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="arr-edit-key">{t('integrations.instanceApiKey')}</Label>
            <Input
              id="arr-edit-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t('common.leaveBlank')}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={!label || !baseUrl || updateMutation.isPending}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ArrInstancesCard({
  title,
  urlPlaceholder,
  instances,
  isPending,
  createMutation,
  updateMutation,
  deleteMutation,
}: {
  title: string
  urlPlaceholder: string
  instances: ArrInstance[] | undefined
  isPending: boolean
  createMutation: UseMutationResult<ArrInstance, Error, ArrInstanceWriteBody>
  updateMutation: UseMutationResult<ArrInstance, Error, { id: number; body: ArrInstanceUpdateBody }>
  deleteMutation: UseMutationResult<void, Error, number>
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{t('integrations.notYetUsedDescription')}</CardDescription>
        </div>
        <AddArrInstanceDialog urlPlaceholder={urlPlaceholder} createMutation={createMutation} />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('integrations.instanceLabel')}</TableHead>
              <TableHead>{t('integrations.instanceUrl')}</TableHead>
              <TableHead>{t('integrations.instanceEnabled')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                  {t('common.loading')}
                </TableCell>
              </TableRow>
            )}
            {instances?.map((instance) => (
              <TableRow key={instance.id}>
                <TableCell className="font-medium">{instance.label}</TableCell>
                <TableCell className="font-mono text-xs">{instance.base_url}</TableCell>
                <TableCell>
                  <Switch
                    checked={instance.enabled}
                    onCheckedChange={(enabled) => updateMutation.mutate({ id: instance.id, body: { enabled } })}
                  />
                </TableCell>
                <TableCell className="flex justify-end gap-1">
                  <EditArrInstanceDialog instance={instance} updateMutation={updateMutation} />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title={t('common.delete')}
                    onClick={() => deleteMutation.mutate(instance.id)}
                  >
                    <TrashIcon className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {instances?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                  {t('integrations.noInstances')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function IntegrationsSection() {
  const { data: radarrInstances, isPending: radarrPending } = useRadarrInstances()
  const createRadarrInstance = useCreateRadarrInstance()
  const updateRadarrInstance = useUpdateRadarrInstance()
  const deleteRadarrInstance = useDeleteRadarrInstance()

  const { data: sonarrInstances, isPending: sonarrPending } = useSonarrInstances()
  const createSonarrInstance = useCreateSonarrInstance()
  const updateSonarrInstance = useUpdateSonarrInstance()
  const deleteSonarrInstance = useDeleteSonarrInstance()

  return (
    <div className="grid gap-6">
      <ArrInstancesCard
        title="Radarr"
        urlPlaceholder="http://radarr:7878"
        instances={radarrInstances}
        isPending={radarrPending}
        createMutation={createRadarrInstance}
        updateMutation={updateRadarrInstance}
        deleteMutation={deleteRadarrInstance}
      />

      <ArrInstancesCard
        title="Sonarr"
        urlPlaceholder="http://sonarr:8989"
        instances={sonarrInstances}
        isPending={sonarrPending}
        createMutation={createSonarrInstance}
        updateMutation={updateSonarrInstance}
        deleteMutation={deleteSonarrInstance}
      />
    </div>
  )
}
