import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AutoApproveSection } from '@/pages/config/AutoApproveSection'
import { DisksSection } from '@/pages/config/DisksSection'
import { IntegrationsSection } from '@/pages/config/IntegrationsSection'
import { TorrentClientsSection } from '@/pages/config/TorrentClientsSection'
import { TrackersSection } from '@/pages/config/TrackersSection'
import { UploadSettingsSection } from '@/pages/config/UploadSettingsSection'

export function ConfigurationPage() {
  return (
    <Tabs defaultValue="mapping">
      <TabsList>
        <TabsTrigger value="mapping">Mapping</TabsTrigger>
        <TabsTrigger value="integrations">Integrations</TabsTrigger>
        <TabsTrigger value="upload">Upload</TabsTrigger>
      </TabsList>
      <TabsContent value="mapping" className="grid gap-6 pt-4">
        <DisksSection />
        <TorrentClientsSection />
        <AutoApproveSection />
      </TabsContent>
      <TabsContent value="integrations" className="grid gap-6 pt-4">
        <TrackersSection />
        <IntegrationsSection />
      </TabsContent>
      <TabsContent value="upload" className="pt-4">
        <UploadSettingsSection />
      </TabsContent>
    </Tabs>
  )
}
