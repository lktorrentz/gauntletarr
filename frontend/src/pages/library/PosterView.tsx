import { ImageOffIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useLibraryItems } from '@/api/hooks/library'
import type { Schemas } from '@/api/client'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getToken } from '@/lib/authToken'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'

type MediaItemOverview = Schemas['MediaItemOverview']

const PAGE_SIZE = 40

function tmdbUrl(item: { content_type: string; tmdb_id: number }) {
  return `https://www.themoviedb.org/${item.content_type === 'tv' ? 'tv' : 'movie'}/${item.tmdb_id}`
}

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

const STATUS_DOTS: { key: StatusKey; className: string }[] = [
  { key: 'seeding', className: 'bg-emerald-500' },
  { key: 'orphan', className: 'bg-red-500' },
  { key: 'review', className: 'bg-amber-500' },
  { key: 'duplicate', className: 'bg-violet-500' },
]

function StatusDots({ counts, showCounts }: { counts: Record<StatusKey, number>; showCounts: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {STATUS_DOTS.filter((d) => counts[d.key] > 0).map((d) => (
        <span
          key={d.key}
          className="flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums"
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

// Il poster è protetto dal login come ogni altra API, e un <img src> non
// manda l'header Authorization: lo si scarica con fetch + token e lo si
// mostra da un object URL — solo quando la card entra nella parte visibile
// della pagina, mai centinaia di richieste al caricamento.
function useAuthedImage(url: string, enabled: boolean) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!enabled || !node || visible) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setVisible(true)
    }, { rootMargin: '300px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [enabled, visible])

  useEffect(() => {
    if (!visible) return
    let objectUrl: string | null = null
    let cancelled = false
    const token = getToken()
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((response) => (response.ok ? response.blob() : Promise.reject(new Error(String(response.status)))))
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setSrc(objectUrl)
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url, visible])

  return { ref, src, failed }
}

function Poster({ card, className }: { card: PosterCard; className?: string }) {
  const { ref, src, failed } = useAuthedImage(
    `/api/library/posters/${card.content_type === 'tv' ? 'tv' : 'movie'}/${card.tmdb_id}.jpg`,
    card.has_poster,
  )
  return (
    <div ref={ref} className={cn('bg-muted', className)}>
      {src && !failed ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <ImageOffIcon className="size-6" />
        </div>
      )}
    </div>
  )
}

function GridCard({ card }: { card: PosterCard }) {
  return (
    <a href={tmdbUrl(card)} target="_blank" rel="noreferrer" className="group" title={cardLabel(card)}>
      <div className="relative aspect-[2/3] overflow-hidden rounded-md border">
        <Poster card={card} className="h-full w-full" />
      </div>
      <p className="mt-1 truncate text-xs text-muted-foreground group-hover:underline">{cardLabel(card)}</p>
      <div className="flex items-center justify-between gap-2">
        <StatusDots counts={card.counts} showCounts={card.content_type === 'tv'} />
        {card.content_type === 'tv' && (
          <span className="text-[11px] text-muted-foreground/70">
            {t('library.episodesCount', { count: card.episodes })}
          </span>
        )}
      </div>
    </a>
  )
}

export function PosterView() {
  const { data, isPending } = useLibraryItems()
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
            <GridCard key={card.key} card={card} />
          ))}
          {visibleCount < cards.length && <div ref={sentinelRef} className="col-span-full h-px" />}
        </div>
      )}
    </div>
  )
}
