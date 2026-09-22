import { en, type MessageKey } from '@/locales/en'

/**
 * Dizionario leggero, inglese di default — niente libreria i18n pesante
 * (react-i18next e simili): un'app di amministrazione self-hosted con un
 * solo utente reale non giustifica il peso extra. Pronto per un secondo
 * locale in futuro (una seconda cartella locales/<lang>/ + uno switch qui
 * dentro), senza dover riscrivere i punti di chiamata t('chiave').
 *
 * I placeholder nel template sono {nome}, sostituiti con params[nome] —
 * un array viene unito con ", ", tutto il resto passa per String(). Una
 * chiave assente ritorna la chiave stessa invece di lanciare, così una UI
 * mai perfettamente in sync col backend resta comunque leggibile invece
 * di rompersi.
 */
export function t(key: MessageKey | (string & {}), params?: Record<string, unknown>): string {
  const template = (en as Record<string, string>)[key] ?? key
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    if (!(name in params)) return match
    const value = params[name]
    return Array.isArray(value) ? value.join(', ') : String(value)
  })
}
