export const integrations = {
  'integrations.contentIdTitle': 'Content identification',
  'integrations.contentIdDescription': 'Used by the resolver during scans and by the upload wizard.',
  'integrations.tvdbApiKeyDescription': 'https://thetvdb.com/api-information — optional, not yet used by the resolver.',
  'integrations.notYetUsedDescription':
    'Not yet used by the resolver — saved for when it gets connected. Multi-instance from day one.',
  'integrations.radarrApiKeyDescription': 'Settings → General in Radarr',
  'integrations.sonarrApiKeyDescription': 'Settings → General in Sonarr',
  'integrations.autoApproveThresholdsTitle': 'Auto-approval thresholds',
  'integrations.autoApproveThresholdsDescription':
    'Minimum confidence (0.0–1.0) above which a match runs automatically, per direction.',

  'integrations.addInstance': 'Add instance',
  'integrations.editInstance': 'Edit instance',
  'integrations.noInstances': 'No instances configured.',
  'integrations.instanceLabel': 'Label',
  'integrations.instanceUrl': 'URL',
  'integrations.instanceApiKey': 'API key',
  'integrations.instanceEnabled': 'Enabled',
  'integrations.createInstanceFailed': 'Could not add instance: {message}',
} as const
