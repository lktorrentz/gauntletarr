import { ChevronRightIcon, ImageOffIcon } from 'lucide-react'
import { useState } from 'react'

import { useLibraryItems } from '@/api/hooks/library'
import type { Schemas } from '@/api/client'
import { StateBadge } from '@/components/StateBadge'
import { Card, CardContent } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

type MediaItemOverview = Schemas['MediaItemOverview']

// Il backend risolve solo tmdb_id/poster (docs/SPEC.md §6), mai il titolo
// testuale — mostrare il vero nome richiederebbe o salvarlo lato server
// al momento della risoluzione o una chiamata TMDB in più per ogni riga,
// nessuna delle due nello scope di questa sotto-fase. Il link a TMDB
// (aperto in una nuova scheda) resta il modo più semplice per l'utente
// di vedere di cosa si tratta davvero.
function tmdbUrl(item: { content_type: string; tmdb_id: number }) {
  return `https://www.themoviedb.org/${item.content_type === 'tv' ? 'tv' : 'movie'}/${item.tmdb_id}`
}

function itemLabel(item: { content_type: string; tmdb_id: number; season_number: number | null; episode_number: number | null }) {
  const base = `${item.content_type === 'tv' ? 'TV' : 'Film'} #${item.tmdb_id}`
  if (item.season_number != null && item.episode_number != null) {
    return `${base} — S${String(item.season_number).padStart(2, '0')}E${String(item.episode_number).padStart(2, '0')}`
  }
  return base
}

function Poster({ tmdbId, hasPoster, className }: { tmdbId: number; hasPoster: boolean; className?: string }) {
  const [failed, setFailed] = useState(false)

  if (!hasPoster || failed) {
    return (
      <div className={cn('flex items-center justify-center bg-muted text-muted-foreground', className)}>
        <ImageOffIcon className="size-6" />
      </div>
    )
  }
  return (
    <img
      src={`/api/library/posters/${tmdbId}.jpg`}
      alt=""
      className={cn('object-cover', className)}
      onError={() => setFailed(true)}
    />
  )
}

function TreeRow({ item }: { item: MediaItemOverview }) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger className="flex w-full items-center gap-3 p-3 text-left">
          <ChevronRightIcon className={cn('size-4 shrink-0 transition-transform', open && 'rotate-90')} />
          <Poster tmdbId={item.tmdb_id} hasPoster={item.has_poster} className="h-12 w-8 shrink-0 rounded" />
          <div className="min-w-0 flex-1">
            <a
              href={tmdbUrl(item)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-medium hover:underline"
            >
              {itemLabel(item)}
            </a>
            <p className="text-xs text-muted-foreground">
              {item.files.length} file{item.files.length === 1 ? '' : 's'}
            </p>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="grid gap-1.5 border-t pt-3">
            {item.files.map((file) => (
              <div key={file.media_file_id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-mono text-xs">{file.relative_path}</span>
                <StateBadge state={file.state} />
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

function GridCard({ item }: { item: MediaItemOverview }) {
  const nonSeeding = item.files.filter((f) => f.state !== 'seeding').length

  return (
    <a href={tmdbUrl(item)} target="_blank" rel="noreferrer" className="group">
      <div className="relative aspect-[2/3] overflow-hidden rounded-md border">
        <Poster tmdbId={item.tmdb_id} hasPoster={item.has_poster} className="h-full w-full" />
        {nonSeeding > 0 && (
          <span className="absolute top-1 right-1 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-medium text-destructive-foreground">
            {nonSeeding}
          </span>
        )}
      </div>
      <p className="mt-1 truncate text-xs text-muted-foreground group-hover:underline">{itemLabel(item)}</p>
    </a>
  )
}

export function LibraryItemsView({ view }: { view: 'tree' | 'grid' }) {
  const { data, isPending } = useLibraryItems()

  if (isPending) return <p className="text-sm text-muted-foreground">Caricamento…</p>
  if (data?.length === 0) return <p className="text-sm text-muted-foreground">Libreria vuota o nessun contenuto risolto ancora.</p>

  if (view === 'grid') {
    return (
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {data?.map((item) => <GridCard key={item.id} item={item} />)}
      </div>
    )
  }

  return (
    <div className="grid gap-2">
      {data?.map((item) => (
        <TreeRow key={item.id} item={item} />
      ))}
    </div>
  )
}
