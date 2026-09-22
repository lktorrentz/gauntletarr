import type { UseMutationResult } from '@tanstack/react-query'
import { PencilIcon, PlusIcon, TrashIcon, ZapIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import {
  useCreateRadarrInstance,
  useCreateSonarrInstance,
  useDeleteRadarrInstance,
  useDeleteSonarrInstance,
  useRadarrInstances,
  useSonarrInstances,
  useTestRadarrInstance,
  useTestSonarrInstance,
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
import { ServiceLogo } from '@/components/ServiceLogo'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { t } from '@/lib/i18n'

// Radarr e Sonarr non sono ancora consumati da nessun adapter (nessun
// resolver li chiama davvero) — ma la tabella è già multi-istanza da
// subito, stesso pattern di Tracker/TorrentClient, per evitare una
// migrazione dolorosa quando arriverà l'adapter vero. Test Connection
// invece è reale già oggi: Radarr/Sonarr condividono lo stesso endpoint
// Servarr /api/v3/system/status, non serve un adapter completo per quello.
interface ArrInstance {
  id: number
  label: string
  base_url: string
  enabled: boolean
  priority: number
  timeout_seconds: number
  basic_auth_username: string | null
}

interface ArrInstanceWriteBody {
  label: string
  base_url: string
  api_key: string
  priority?: number
  timeout_seconds?: number
  basic_auth_username?: string
  basic_auth_password?: string
}

interface ArrInstanceUpdateBody {
  label?: string
  base_url?: string
  api_key?: string
  enabled?: boolean
  priority?: number
  timeout_seconds?: number
  basic_auth_username?: string
  basic_auth_password?: string
}

interface ArrInstanceTestResult {
  status: string
  version?: string | null
  error?: string | null
}

function BasicAuthFields({
  enabled,
  onEnabledChange,
  username,
  onUsernameChange,
  password,
  onPasswordChange,
  passwordPlaceholder,
}: {
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  username: string
  onUsernameChange: (value: string) => void
  password: string
  onPasswordChange: (value: string) => void
  passwordPlaceholder?: string
}) {
  return (
    <div className="grid gap-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <div>
          <Label>{t('integrations.basicAuth')}</Label>
          <p className="text-xs text-muted-foreground">{t('integrations.basicAuthDescription')}</p>
        </div>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </div>
      {enabled && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>{t('integrations.basicAuthUsername')}</Label>
            <Input value={username} onChange={(e) => onUsernameChange(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>{t('integrations.basicAuthPassword')}</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder={passwordPlaceholder}
            />
          </div>
        </div>
      )}
    </div>
  )
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
  const [priority, setPriority] = useState('0')
  const [timeoutSeconds, setTimeoutSeconds] = useState('15')
  const [basicAuth, setBasicAuth] = useState(false)
  const [basicAuthUsername, setBasicAuthUsername] = useState('')
  const [basicAuthPassword, setBasicAuthPassword] = useState('')

  function reset() {
    setLabel('')
    setBaseUrl('')
    setApiKey('')
    setPriority('0')
    setTimeoutSeconds('15')
    setBasicAuth(false)
    setBasicAuthUsername('')
    setBasicAuthPassword('')
  }

  function submit() {
    createMutation.mutate(
      {
        label, base_url: baseUrl, api_key: apiKey,
        priority: Number(priority) || 0, timeout_seconds: Number(timeoutSeconds) || 15,
        basic_auth_username: basicAuth ? basicAuthUsername : undefined,
        basic_auth_password: basicAuth ? basicAuthPassword : undefined,
      },
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="arr-add-priority">{t('integrations.priority')}</Label>
              <Input id="arr-add-priority" type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="arr-add-timeout">{t('integrations.timeoutSeconds')}</Label>
              <Input
                id="arr-add-timeout"
                type="number"
                value={timeoutSeconds}
                onChange={(e) => setTimeoutSeconds(e.target.value)}
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">{t('integrations.priorityHelp')}</p>
          <BasicAuthFields
            enabled={basicAuth}
            onEnabledChange={setBasicAuth}
            username={basicAuthUsername}
            onUsernameChange={setBasicAuthUsername}
            password={basicAuthPassword}
            onPasswordChange={setBasicAuthPassword}
          />
        </div>
        <DialogFooter>
          <Button
            onClick={submit}
            disabled={
              !label || !baseUrl || !apiKey || (basicAuth && !basicAuthUsername) || createMutation.isPending
            }
          >
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
  const [priority, setPriority] = useState(String(instance.priority))
  const [timeoutSeconds, setTimeoutSeconds] = useState(String(instance.timeout_seconds))
  const [basicAuth, setBasicAuth] = useState(instance.basic_auth_username !== null)
  const [basicAuthUsername, setBasicAuthUsername] = useState(instance.basic_auth_username ?? '')
  const [basicAuthPassword, setBasicAuthPassword] = useState('')

  function submit() {
    updateMutation.mutate(
      {
        id: instance.id,
        body: {
          label, base_url: baseUrl, api_key: apiKey || undefined,
          priority: Number(priority) || 0, timeout_seconds: Number(timeoutSeconds) || 15,
          basic_auth_username: basicAuth ? basicAuthUsername : '',
          basic_auth_password: basicAuth && basicAuthPassword ? basicAuthPassword : undefined,
        },
      },
      {
        onSuccess: () => {
          setOpen(false)
          setApiKey('')
          setBasicAuthPassword('')
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="arr-edit-priority">{t('integrations.priority')}</Label>
              <Input
                id="arr-edit-priority"
                type="number"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="arr-edit-timeout">{t('integrations.timeoutSeconds')}</Label>
              <Input
                id="arr-edit-timeout"
                type="number"
                value={timeoutSeconds}
                onChange={(e) => setTimeoutSeconds(e.target.value)}
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">{t('integrations.priorityHelp')}</p>
          <BasicAuthFields
            enabled={basicAuth}
            onEnabledChange={setBasicAuth}
            username={basicAuthUsername}
            onUsernameChange={setBasicAuthUsername}
            password={basicAuthPassword}
            onPasswordChange={setBasicAuthPassword}
            passwordPlaceholder={t('common.leaveBlank')}
          />
        </div>
        <DialogFooter>
          <Button
            onClick={submit}
            disabled={!label || !baseUrl || (basicAuth && !basicAuthUsername) || updateMutation.isPending}
          >
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TestArrInstanceButton({
  id,
  testMutation,
}: {
  id: number
  testMutation: UseMutationResult<ArrInstanceTestResult, Error, number>
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      title={t('integrations.testConnection')}
      onClick={() =>
        testMutation.mutate(id, {
          onSuccess: (result) => {
            if (result.status === 'ok') toast.success(t('integrations.connectedSuccess', { version: result.version ?? '?' }))
            else toast.error(t('integrations.connectionFailed', { message: result.error ?? '' }))
          },
        })
      }
    >
      <ZapIcon className="size-4" />
    </Button>
  )
}

function ArrInstancesCard({
  title,
  logoSrc,
  urlPlaceholder,
  instances,
  isPending,
  createMutation,
  updateMutation,
  deleteMutation,
  testMutation,
}: {
  title: string
  logoSrc: string
  urlPlaceholder: string
  instances: ArrInstance[] | undefined
  isPending: boolean
  createMutation: UseMutationResult<ArrInstance, Error, ArrInstanceWriteBody>
  updateMutation: UseMutationResult<ArrInstance, Error, { id: number; body: ArrInstanceUpdateBody }>
  deleteMutation: UseMutationResult<void, Error, number>
  testMutation: UseMutationResult<ArrInstanceTestResult, Error, number>
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <ServiceLogo src={logoSrc} alt={title} />
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{t('integrations.notYetUsedDescription')}</CardDescription>
          </div>
        </div>
        <AddArrInstanceDialog urlPlaceholder={urlPlaceholder} createMutation={createMutation} />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('integrations.instanceLabel')}</TableHead>
              <TableHead>{t('integrations.instanceUrl')}</TableHead>
              <TableHead>{t('integrations.priority')}</TableHead>
              <TableHead>{t('integrations.instanceEnabled')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  {t('common.loading')}
                </TableCell>
              </TableRow>
            )}
            {instances?.map((instance) => (
              <TableRow key={instance.id}>
                <TableCell className="font-medium">{instance.label}</TableCell>
                <TableCell className="font-mono text-xs">{instance.base_url}</TableCell>
                <TableCell className="font-mono text-xs">{instance.priority}</TableCell>
                <TableCell>
                  <Switch
                    checked={instance.enabled}
                    onCheckedChange={(enabled) => updateMutation.mutate({ id: instance.id, body: { enabled } })}
                  />
                </TableCell>
                <TableCell className="flex justify-end gap-1">
                  <TestArrInstanceButton id={instance.id} testMutation={testMutation} />
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
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
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
  const testRadarrInstance = useTestRadarrInstance()

  const { data: sonarrInstances, isPending: sonarrPending } = useSonarrInstances()
  const createSonarrInstance = useCreateSonarrInstance()
  const updateSonarrInstance = useUpdateSonarrInstance()
  const deleteSonarrInstance = useDeleteSonarrInstance()
  const testSonarrInstance = useTestSonarrInstance()

  return (
    <div className="grid gap-6">
      <ArrInstancesCard
        title="Radarr"
        logoSrc="/logos/radarr.svg"
        urlPlaceholder="http://radarr:7878"
        instances={radarrInstances}
        isPending={radarrPending}
        createMutation={createRadarrInstance}
        updateMutation={updateRadarrInstance}
        deleteMutation={deleteRadarrInstance}
        testMutation={testRadarrInstance}
      />

      <ArrInstancesCard
        title="Sonarr"
        logoSrc="/logos/sonarr.svg"
        urlPlaceholder="http://sonarr:8989"
        instances={sonarrInstances}
        isPending={sonarrPending}
        createMutation={createSonarrInstance}
        updateMutation={updateSonarrInstance}
        deleteMutation={deleteSonarrInstance}
        testMutation={testSonarrInstance}
      />
    </div>
  )
}
