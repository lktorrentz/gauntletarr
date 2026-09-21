import { useQuery } from '@tanstack/react-query'

import { api } from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Placeholder funzionale per la Sotto-fase 8.0: prova che l'intera
// pipeline (client tipizzato -> proxy Vite/mount statico -> FastAPI) è
// collegata, chiamando un endpoint reale invece di dati finti. La vera
// Dashboard (gauge di salute, KPI, storico) arriva nella Sotto-fase 8.2 -
// vedi il piano della Fase 8.
export function DashboardPage() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/health')
      if (error) throw error
      return data
    },
  })

  return (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>Stato backend</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        {isPending && <p className="text-muted-foreground">Verifica in corso…</p>}
        {isError && <p className="text-destructive">Backend non raggiungibile: {String(error)}</p>}
        {data !== undefined && <pre className="rounded bg-muted p-3">{JSON.stringify(data, null, 2)}</pre>}
      </CardContent>
    </Card>
  )
}
