// Codici restituiti dal backend come HTTPException(detail={"code", "params"})
// — vedi app/api_errors.py. Ogni codice qui deve avere una controparte
// backend che lo solleva con esattamente questi nomi di parametro.
export const errors = {
  'errors.auth_already_configured': 'Login already configured.',
  'errors.auth_username_required': 'Username is required.',
  'errors.auth_password_too_short': 'Password must be at least 8 characters.',
  'errors.auth_invalid_credentials': 'Invalid credentials.',
  'errors.auth_required': 'Authentication required.',
  'errors.auth_wrong_current_password': 'Current password is incorrect.',

  'errors.poster_not_cached': 'Poster not cached.',

  'errors.disk_not_found': 'Disk {id} not found.',
  'errors.disk_root_path_unreachable': 'root_path is not reachable: {path}',
  'errors.disk_root_path_not_a_directory': 'root_path is not a reachable folder: {path}',
  'errors.disk_root_path_outside_scan_root': 'root_path must be inside disk_scan_root ({scan_root})',
  'errors.disk_root_path_conflict': 'A disk with root_path {path} already exists.',
  'errors.path_not_found': 'Path not found: {path}',
  'errors.folder_already_exists': 'Folder already exists: {path}',
  'errors.path_outside_scope': 'Path outside the allowed scope: {path}',

  'errors.run_not_found': 'Scan {id} not found.',
  'errors.media_item_not_found': 'This item is not in the library.',
  'errors.run_in_progress': 'A scan is in progress: try again when it has finished.',
  'errors.invalid_path': 'Invalid path.',
  'errors.run_already_finished': 'Scan {id} has already finished.',

  'errors.review_not_found': 'Review {id} not found.',
  'errors.seed_job_not_found': 'SeedJob {id} not found.',

  'errors.tracker_not_found': 'Tracker {id} not found.',
  'errors.tracker_adapter_type_unsupported': 'Unsupported adapter_type: {adapter_type} (supported: {supported})',
  'errors.tracker_no_upload_profile': 'Tracker {tracker} has no upload profile.',
  'errors.tracker_upload_profile_conflict': 'Tracker {id} already has an upload profile.',
  'errors.tracker_missing_announce_url': "Tracker '{tracker}' has no announce_url configured.",

  'errors.torrent_client_not_found': 'Torrent client {id} not found.',
  'errors.torrent_client_adapter_type_unsupported':
    'adapter_type not yet implemented: {adapter_type} (supported: {supported})',

  'errors.radarr_instance_not_found': 'Radarr instance {id} not found.',
  'errors.sonarr_instance_not_found': 'Sonarr instance {id} not found.',

  'errors.invalid_cron_expression': 'Invalid cron expression: {message}',

  'errors.upload_job_not_found': 'upload_job {id} not found.',
  'errors.not_a_file': 'Not a file: {path}',
  'errors.upload_missing_tmdb_id': 'upload_job has no tmdb_id: set identification first.',
  'errors.upload_job_wrong_status': "upload_job is in status '{status}', expected 'ready' (run /prepare first).",
  'errors.upload_job_incomplete':
    'upload_job incomplete: category_id/type_id/resolution_id/tmdb_id must all be resolved '
    + '(or corrected manually) before submitting.',

  'errors.tmdb_api_key_missing': 'tmdb_api_key not configured in app_settings (PUT /api/settings/tmdb_api_key).',
  'errors.image_host_unknown': 'Unknown image host in image_host_priority: {key}',
  'errors.no_image_host_configured':
    'No image host configured: set at least one api_key, or include Imgbox/Pixhost in image_host_priority '
    + "— they're the only two that don't require one.",
  'errors.bundled_profile_not_found': 'Bundled profile not found: {key}',
} as const
