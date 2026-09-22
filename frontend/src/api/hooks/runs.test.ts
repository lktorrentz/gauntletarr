import { describe, expect, it } from 'vitest'

import { nextRunsRefetchInterval } from '@/api/hooks/runs'
import type { Schemas } from '@/api/client'

function run(overrides: Partial<Schemas['RunResponse']>): Schemas['RunResponse'] {
  return {
    id: 1,
    started_at: '2026-01-01T00:00:00Z',
    finished_at: '2026-01-01T00:01:00Z',
    ...overrides,
  } as Schemas['RunResponse']
}

describe('nextRunsRefetchInterval', () => {
  it('does not poll when there is no data yet', () => {
    expect(nextRunsRefetchInterval(undefined)).toBe(false)
  })

  it('does not poll when every run has finished', () => {
    expect(nextRunsRefetchInterval([run({ finished_at: '2026-01-01T00:01:00Z' })])).toBe(false)
  })

  it('polls every 3s while at least one run is still in progress', () => {
    expect(
      nextRunsRefetchInterval([run({ finished_at: '2026-01-01T00:01:00Z' }), run({ id: 2, finished_at: null })]),
    ).toBe(3_000)
  })
})
