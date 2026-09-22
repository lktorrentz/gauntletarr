import { HardDriveIcon, InfoIcon, PlugIcon, ScrollTextIcon, ShieldIcon, UploadCloudIcon } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApplicationSection } from '@/pages/config/ApplicationSection'
import { AutoApproveSection } from '@/pages/config/AutoApproveSection'
import { DisksSection } from '@/pages/config/DisksSection'
import { IntegrationsSection } from '@/pages/config/IntegrationsSection'
import { LogsSection } from '@/pages/config/LogsSection'
import { SecuritySection } from '@/pages/config/SecuritySection'
import { TorrentClientsSection } from '@/pages/config/TorrentClientsSection'
import { TrackersSection } from '@/pages/config/TrackersSection'
import { UploadSettingsSection } from '@/pages/config/UploadSettingsSection'

export function ConfigurationPage() {
  return (
    <Tabs defaultValue="mapping" orientation="vertical">
      <TabsList className="w-56 shrink-0 items-stretch gap-1 bg-transparent p-0">
        <TabsTrigger value="mapping" className="justify-start gap-2 px-3 py-2">
          <HardDriveIcon />
          Mapping
        </TabsTrigger>
        <TabsTrigger value="integrations" className="justify-start gap-2 px-3 py-2">
          <PlugIcon />
          Integrations
        </TabsTrigger>
        <TabsTrigger value="upload" className="justify-start gap-2 px-3 py-2">
          <UploadCloudIcon />
          Upload
        </TabsTrigger>
        <TabsTrigger value="security" className="justify-start gap-2 px-3 py-2">
          <ShieldIcon />
          Security
        </TabsTrigger>
        <TabsTrigger value="application" className="justify-start gap-2 px-3 py-2">
          <InfoIcon />
          Application
        </TabsTrigger>
        <TabsTrigger value="logs" className="justify-start gap-2 px-3 py-2">
          <ScrollTextIcon />
          Logs
        </TabsTrigger>
      </TabsList>
      <TabsContent value="mapping" className="grid gap-6">
        <DisksSection />
        <TorrentClientsSection />
        <AutoApproveSection />
      </TabsContent>
      <TabsContent value="integrations" className="grid gap-6">
        <TrackersSection />
        <IntegrationsSection />
      </TabsContent>
      <TabsContent value="upload">
        <UploadSettingsSection />
      </TabsContent>
      <TabsContent value="security">
        <SecuritySection />
      </TabsContent>
      <TabsContent value="application">
        <ApplicationSection />
      </TabsContent>
      <TabsContent value="logs">
        <LogsSection />
      </TabsContent>
    </Tabs>
  )
}
