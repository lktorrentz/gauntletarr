export const exclusions = {
  'exclusions.tab': 'Exclusions',
  'exclusions.presetsTitle': 'Presets',
  'exclusions.presetsDescription':
    'Ready-made patterns for common junk. Excluded files stay on disk and are still scanned. They are just hidden by default in Media files and Torrent files and never counted in the totals.',
  'exclusions.preset.scene_junk': 'Scene/tracker junk',
  'exclusions.preset.qbittorrent_incomplete': 'qBittorrent incomplete files',
  'exclusions.preset.utorrent_incomplete': 'uTorrent incomplete files',
  'exclusions.preset.bitcomet_incomplete': 'BitComet incomplete files',
  'exclusions.customTitle': 'Custom patterns',
  'exclusions.customDescription':
    'One pattern per line, case-insensitive. A pattern without "/" matches the file name at any depth (*.nfo). A pattern with "/" matches that path from any folder (sample/*).',
  'exclusions.mediaVideoOnlyNote':
    'The library scan only reads video files, so patterns for non-video files (nfo, subtitles, images) only have an effect in Torrent files.',
  'exclusions.save': 'Save patterns',
  'exclusions.saved': 'Exclusion patterns saved.',
  'exclusions.presetsSaved': 'Exclusion presets updated.',
} as const
