// localStorage invece che in-memory: un JWT valido 30 giorni (app/auth.py)
// deve sopravvivere a un refresh della pagina, non solo alla sessione tab.
const STORAGE_KEY = 'gauntletarr_token'

export function getToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, token)
  } catch {
    // storage non disponibile (privata/bloccato): l'utente dovrà rifare
    // login a ogni refresh, mai un errore bloccante per questo.
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // vedi sopra
  }
}
