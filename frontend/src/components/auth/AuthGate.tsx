import { type ReactNode, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { logout, useAuthStatus, useLogin, useMe, useSetup } from '@/api/hooks/auth'
import { AuthContext } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function CenteredCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  )
}

function SetupScreen() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const setup = useSetup()

  return (
    <CenteredCard title="The Media Gauntlet*rr" description="Crea l'account amministratore — un solo utente, mai basic auth.">
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          setup.mutate(
            { username, password },
            { onError: (error) => toast.error(`Creazione fallita: ${error.message}`) },
          )
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="setup-username">Username</Label>
          <Input id="setup-username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="setup-password">Password</Label>
          <Input
            id="setup-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Almeno 8 caratteri"
          />
        </div>
        <Button type="submit" disabled={!username || password.length < 8 || setup.isPending}>
          Crea account
        </Button>
      </form>
    </CenteredCard>
  )
}

function LoginScreen() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const login = useLogin()

  return (
    <CenteredCard title="The Media Gauntlet*rr" description="Accedi per continuare.">
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          login.mutate(
            { username, password },
            { onError: () => toast.error('Credenziali non valide.') },
          )
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="login-username">Username</Label>
          <Input id="login-username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="login-password">Password</Label>
          <Input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" disabled={!username || !password || login.isPending}>
          Accedi
        </Button>
      </form>
    </CenteredCard>
  )
}

export function AuthGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { data: status, isPending: statusPending } = useAuthStatus()
  const { data: me, isPending: mePending, isError: meError } = useMe(status?.configured === true)

  if (statusPending) return null
  if (!status?.configured) return <SetupScreen />
  if (mePending) return null
  if (meError || !me) return <LoginScreen />

  return (
    <AuthContext.Provider value={{ username: me.username, logout: () => logout(queryClient) }}>
      {children}
    </AuthContext.Provider>
  )
}
