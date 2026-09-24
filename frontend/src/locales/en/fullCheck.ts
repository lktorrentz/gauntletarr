export const fullCheck = {
  'fullCheck.button': 'Full hash check',
  'fullCheck.hint': 'Verify every piece of the torrent against the local files, like the client recheck',
  'fullCheck.title': 'Full hash check',
  'fullCheck.explanation':
    "Downloads the .torrent and verifies 100% of its pieces against the local files, exactly like the client's recheck, including the pieces shared between two files. Files are read where the client sees them (the hardlinks made by the execution) or, failing that, from the library. Read-only: nothing is changed. It reads the whole content, so a large file can take a few minutes; it keeps running if you close this window.",
  'fullCheck.start': 'Start check',
  'fullCheck.runAgain': 'Run again',
  'fullCheck.queued': 'Waiting for another check to finish…',
  'fullCheck.downloadingTorrent': 'Downloading the .torrent…',
  'fullCheck.cancelled': 'Check cancelled.',
  'fullCheck.piecesSummary': '{ok} of {total} pieces verified · {size} per piece',
  'fullCheck.verdictOk':
    "The local data is identical to the torrent. If the client still doesn't seed it, it's looking somewhere else: check the save path and folder name the client was given.",
  'fullCheck.verdictOkNotInSeed':
    'The library data is identical to the torrent, but some files are not where the client looks for them (read from the library, not from the seeding folder): the hardlinks are missing or named differently.',
  'fullCheck.verdictMismatch':
    "{count} pieces differ from the torrent: the local file is not the same as the torrent's (different release, edit or re-encode), so it can't be seeded with this torrent.",
  'fullCheck.verdictUnreadable':
    "{count} pieces can't be verified because a file is missing or shorter than expected. The client would need to download them.",
  'fullCheck.verdictHashChanged':
    'Every piece matches, but the .torrent downloaded now has a different info hash than the one added to the client: the tracker has replaced the torrent.',
  'fullCheck.readFromSeed': 'seeding folder',
  'fullCheck.readFromLibrary': 'library',
  'fullCheck.noLocalFile': 'No local file found',
  'fullCheck.sizeDiffers': 'Local size {local}, torrent expects {expected}',
  'fullCheck.fileMismatch': '{count} pieces differ, first one at {offset} into the file',
  'fullCheck.fileUnreadable': '{count} pieces not verifiable (file missing or shorter)',
  'fullCheck.expectedHash': 'Added to the client as {hash}',
} as const
