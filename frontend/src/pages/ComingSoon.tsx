export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-1 text-center text-muted-foreground">
      <p className="text-lg font-medium text-foreground">{title}</p>
      <p className="text-sm">Non ancora implementata — arriva in una prossima sotto-fase della Fase 8.</p>
    </div>
  )
}
