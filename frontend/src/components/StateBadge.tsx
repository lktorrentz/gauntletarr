import { Badge } from '@/components/ui/badge'

// Stati unificati per file, docs/SPEC.md §3 — stessa terminologia esatta
// usata da app/library.py, mai reinventata lato frontend.
const STATE_LABELS: Record<string, string> = {
  seeding: 'seeding',
  orphan_media: 'orphan media',
  orphan_torrent: 'orphan torrent',
  ignored: 'ignored',
  unmatched: 'unmatched',
}

const STATE_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  seeding: 'default',
  orphan_media: 'destructive',
  orphan_torrent: 'destructive',
  ignored: 'secondary',
  unmatched: 'outline',
}

export function StateBadge({ state }: { state: string }) {
  return <Badge variant={STATE_VARIANTS[state] ?? 'outline'}>{STATE_LABELS[state] ?? state}</Badge>
}
