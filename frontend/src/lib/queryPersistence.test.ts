import type { Query } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { shouldPersistQuery } from '@/lib/queryPersistence'

const query = (key: unknown[], status: string) => ({ queryKey: key, state: { status } }) as unknown as Query

describe('shouldPersistQuery', () => {
  it('persists only successful library views, never runs, reviews or auth', () => {
    expect(shouldPersistQuery(query(['library', 'media-files', undefined], 'success'))).toBe(true)
    expect(shouldPersistQuery(query(['library', 'items', undefined], 'error'))).toBe(false)
    expect(shouldPersistQuery(query(['runs'], 'success'))).toBe(false)
    expect(shouldPersistQuery(query(['auth', 'me'], 'success'))).toBe(false)
  })
})
