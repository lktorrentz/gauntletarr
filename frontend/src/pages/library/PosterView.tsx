import { ImageOffIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useLibraryItems } from '@/api/hooks/library'
import type { Schemas } from '@/api/client'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

type MediaItemOverview = Schemas['MediaItemOverview']

// Il backend risolve solo tmdb_id/poster, mai il titolo testuale — mostrare
// il vero nome richiederebbe salvarlo lato server al momento della
// risoluzione o una chiamata TMDB in più per riga. Il link a TMDB (aperto
// in una nuova scheda) resta il modo più semplice per vedere di cosa si tratta.
function tmdbUrl(item: { content_type: string; tmdb_id: number }) {
  return `https://www.themoviedb.org/${item.content_type === 'tv' ? 'tv' : 'movie'}/${item.tmdb_id}`
}

function itemLabel(item: {
  content_type: string
  tmdb_id: number
  season_number: number | null
  episode_number: number | null
}) {
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

function GridCard({ item }: { item: MediaItemOverview }) {
  // I file esclusi non devono mai far apparire un problema che non c'è.
  const relevant = item.files.filter((f) => !f.excluded)
  const problems = relevant.filter((f) => f.state !== 'seeding').length

  return (
    <a href={tmdbUrl(item)} target="_blank" rel="noreferrer" className="group">
      <div className="relative aspect-[2/3] overflow-hidden rounded-md border">
        <Poster tmdbId={item.tmdb_id} hasPoster={item.has_poster} className="h-full w-full" />
        {problems > 0 && (
          <span className="absolute top-1 right-1 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-medium text-destructive-foreground">
            {problems}
          </span>
        )}
      </div>
      <p className="mt-1 truncate text-xs text-muted-foreground group-hover:underline">{itemLabel(item)}</p>
    </a>
  )
}

export function PosterView() {
  const { data, isPending } = useLibraryItems()
  const [contentType, setContentType] = useState<'movie' | 'tv'>('movie')

  const items = useMemo(() => (data ?? []).filter((item) => item.content_type === contentType), [data, contentType])

  if (isPending) return <p className="text-sm text-muted-foreground">Caricamento…</p>

  return (
    <div className="grid gap-4">
      <Tabs value={contentType} onValueChange={(v) => setContentType(v as 'movie' | 'tv')}>
        <TabsList>
          <TabsTrigger value="movie">Film</TabsTrigger>
          <TabsTrigger value="tv">TV</TabsTrigger>
        </TabsList>
      </Tabs>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nessun contenuto risolto in questa categoria.</p>
      ) : (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {items.map((item) => (
            <GridCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
