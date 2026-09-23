export const integrations = {
  'integrations.arrUsageDescription':
    'Read-only. On every run, files these instances know are identified without a TMDB search, and orphan files are matched to the torrent they were imported from (from the history) without searching the tracker. Files are matched by folder, file name and exact size, so no path mapping is needed.',
  'integrations.autoApproveThresholdsTitle': 'Auto-approval thresholds',
  'integrations.rematchTitle': 'Tracker search frequency',
  'integrations.rematchDescription':
    'An orphan file already searched on a tracker is not searched again on every run: its candidates and review stay as they are until the file changes or this interval passes. Keeps runs from hitting tracker rate limits.',
  'integrations.rematchLabel': 'Search again after (days)',
  'integrations.rematchHelp': 'Default: 7. Use 0 to search every orphan on every run.',
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
