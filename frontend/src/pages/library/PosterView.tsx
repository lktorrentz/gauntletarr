import { useEffect, useMemo, useRef, useState } from 'react'

import { useLibraryItems } from '@/api/hooks/library'
import type { Schemas } from '@/api/client'
import { AuthedPoster } from '@/components/AuthedPoster'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { t } from '@/lib/i18n'
import { STATUS_STYLES } from '@/lib/status-styles'
import { cn } from '@/lib/utils'
import { ItemDetailSheet, type OpenItem } from '@/pages/library/ItemDetailSheet'

type MediaItemOverview = Schemas['MediaItemOverview']

const PAGE_SIZE = 40

// Una card per film, una per SERIE (non per episodio: a parità di
// poster sarebbero migliaia di card identiche).
interface PosterCard {
  key: string
  content_type: string
  tmdb_id: number
  title: string | null
  year: number | null
  has_poster: boolean
  episodes: number
  counts: Record<StatusKey, number>
}

// Pallini di stato, contati per file (per una serie: per episodio). I
// file esclusi non contano mai, come nel resto dell'interfaccia.
type StatusKey = 'seeding' | 'orphan' | 'review' | 'duplicate'

const STATUS_DOTS: { key: StatusKey; className: string }[] = (
  ['seeding', 'orphan', 'review', 'duplicate'] as const
).map((key) => ({ key, className: STATUS_STYLES[key].dot }))

function StatusDots({ counts, showCounts }: { counts: Record<StatusKey, number>; showCounts: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {STATUS_DOTS.filter((d) => counts[d.key] > 0).map((d) => (
        <span
          key={d.key}
          className="flex items-center gap-1 text-[10px] text-white/80 tabular-nums"
          title={t(`library.status.${d.key}`)}
        >
          <span className={cn('size-2 rounded-full', d.className)} />
          {showCounts && counts[d.key]}
        </span>
      ))}
    </div>
  )
}

function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {STATUS_DOTS.map((d) => (
        <span key={d.key} className="flex items-center gap-1.5">
          <span className={cn('size-2 rounded-full', d.className)} />
          {t(`library.status.${d.key}`)}
        </span>
      ))}
    </div>
  )
}

function toCards(items: MediaItemOverview[]): PosterCard[] {
  const cards = new Map<string, PosterCard>()
  for (const item of items) {
    const key = `${item.content_type}-${item.tmdb_id}`
    const card = cards.get(key) ?? {
      key, content_type: item.content_type, tmdb_id: item.tmdb_id, title: null, year: null,
      has_poster: false, episodes: 0, counts: { seeding: 0, orphan: 0, review: 0, duplicate: 0 },
    }
    card.title ??= item.title ?? null
    card.year ??= item.year ?? null
    card.has_poster ||= item.has_poster
    card.episodes += 1
    for (const f of item.files) {
      if (f.excluded) continue
      if (f.state === 'seeding') card.counts.seeding += 1
      else card.counts.orphan += 1
      if (f.in_review) card.counts.review += 1
      if (f.duplicate) card.counts.duplicate += 1
    }
    cards.set(key, card)
  }
  return [...cards.values()].sort((a, b) =>
    (a.title ?? '\uffff').localeCompare(b.title ?? '\uffff') || a.tmdb_id - b.tmdb_id,
  )
}

function cardLabel(card: PosterCard): string {
  if (!card.title) return `${card.content_type === 'tv' ? 'TV' : t('library.movie')} #${card.tmdb_id}`
  return card.year ? `${card.title} (${card.year})` : card.title
}

// Titolo e pallini dentro il poster, in basso, su una sfumatura scura
// per restare leggibili su qualunque immagine. Il clic apre la scheda di
// dettaglio (TMDB è uno dei link lì dentro).
function GridCard({ card, onOpen }: { card: PosterCard; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="group text-left" title={cardLabel(card)}>
      <div className="relative aspect-[2/3] overflow-hidden rounded-md border transition group-hover:ring-2 group-hover:ring-primary/50">
        <AuthedPoster
          contentType={card.content_type}
          tmdbId={card.tmdb_id}
          hasPoster={card.has_poster}
          className="h-full w-full"
        />
        <div className="absolute inset-x-0 bottom-0 grid gap-1 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-2 pt-8 pb-1.5">
          <p className="line-clamp-2 text-xs font-medium text-white">{cardLabel(card)}</p>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-white/70">
              {card.content_type === 'tv' && t('library.episodesCount', { count: card.episodes })}
            </span>
            <StatusDots counts={card.counts} showCounts={card.content_type === 'tv'} />
          </div>
        </div>
      </div>
    </button>
  )
}

export function PosterView() {
  const { data, isPending } = useLibraryItems()
  const [openItem, setOpenItem] = useState<OpenItem | null>(null)
  const [contentType, setContentType] = useState<'movie' | 'tv'>('movie')

  const cards = useMemo(
    () => toCards((data ?? []).filter((item) => item.content_type === contentType)),
    [data, contentType],
  )
  // Solo i primi PAGE_SIZE poster, altri PAGE_SIZE ogni volta che il fondo
  // della griglia si avvicina: renderizzare centinaia di card (e i loro
  // poster) tutte insieme rallentava l'apertura della pagina.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const node = sentinelRef.current
    if (!node || visibleCount >= cards.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisibleCount((n) => n + PAGE_SIZE)
      },
      { rootMargin: '600px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [visibleCount, cards.length])

  if (isPending) return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={contentType}
          onValueChange={(v) => {
            setContentType(v as 'movie' | 'tv')
            setVisibleCount(PAGE_SIZE)
          }}
        >
          <TabsList>
            <TabsTrigger value="movie">{t('library.movie')}</TabsTrigger>
            <TabsTrigger value="tv">TV</TabsTrigger>
          </TabsList>
        </Tabs>
        <StatusLegend />
      </div>
      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('library.noResolvedContent')}</p>
      ) : (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {cards.slice(0, visibleCount).map((card) => (
            <GridCard
              key={card.key}
              card={card}
              onOpen={() => setOpenItem({ contentType: card.content_type, tmdbId: card.tmdb_id })}
            />
          ))}
          {visibleCount < cards.length && <div ref={sentinelRef} className="col-span-full h-px" />}
        </div>
      )}
      <ItemDetailSheet item={openItem} onClose={() => setOpenItem(null)} />
    </div>
  )
}
