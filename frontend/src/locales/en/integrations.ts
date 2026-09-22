export const integrations = {
  'integrations.notYetUsedDescription':
    'Not yet used by the resolver — saved for when it gets connected. Multi-instance from day one.',
  'integrations.autoApproveThresholdsTitle': 'Auto-approval thresholds',
  'integrations.autoApproveThresholdsDescription':
    'Minimum confidence (0.0–1.0) above which a match runs automatically, per direction.',

  'integrations.addInstance': 'Add instance',
  'integrations.addInstanceTitled': 'Add {name} instance',
  'integrations.editInstanceTitled': 'Edit {name} instance',
  'integrations.noInstances': 'No instances configured.',
  'integrations.instanceLabel': 'Label',
  'integrations.instanceUrl': 'URL',
  'integrations.urlSuggestion': 'e.g. {url}',
  'integrations.instanceApiKey': 'API key',
  'integrations.apiKeyHelp': 'Found in Settings → General in {name}.',
  'integrations.instanceEnabled': 'Enabled',
  'integrations.createInstanceFailed': 'Could not add instance: {message}',

  'integrations.priority': 'Priority',
  'integrations.priorityHelp': 'Higher values are queried first, once a resolver uses these.',
  'integrations.timeoutSeconds': 'Timeout (seconds)',
  'integrations.basicAuth': 'HTTP basic auth',
  'integrations.basicAuthDescription': 'For an instance sitting behind a reverse proxy with basic authentication.',
  'integrations.basicAuthUsername': 'Username',
  'integrations.basicAuthPassword': 'Password',
  'integrations.testConnection': 'Test connection',
  'integrations.connectedSuccess': 'Connected — v{version}.',
  'integrations.connectionFailed': 'Connection failed: {message}',
} as const
