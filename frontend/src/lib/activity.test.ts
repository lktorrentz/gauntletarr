import { afterEach, describe, expect, it, vi } from 'vitest'

import { dismissActivity, pushActivity, resetActivities, updateActivity } from '@/lib/activity'

// Legge lo stato corrente dello store come fa useSyncExternalStore.
async function current() {
  const mod = await import('@/lib/activity')
  let snapshot: ReturnType<typeof mod.useActivities> = []
  const { renderHook } = await import('@testing-library/react')
  const { result } = renderHook(() => mod.useActivities())
  snapshot = result.current
  return snapshot
}

describe('activity store', () => {
  afterEach(() => {
    resetActivities()
    vi.useRealTimers()
  })

  it('keeps a running activity until it finishes, then auto-dismisses the success', async () => {
    vi.useFakeTimers()
    const id = pushActivity({ status: 'running', title: 'Approving…' })
    vi.advanceTimersByTime(60_000)
    expect((await current()).map((a) => a.status)).toEqual(['running'])

    updateActivity(id, { status: 'success', title: 'Added to the client' })
    expect((await current())[0].title).toBe('Added to the client')
    vi.advanceTimersByTime(8_001)
    expect(await current()).toEqual([])
  })

  it('shows the newest first, at most five, and can be dismissed', async () => {
    const ids = Array.from({ length: 7 }, (_, i) => pushActivity({ status: 'error', title: `e${i}` }))
    const shown = await current()
    expect(shown.map((a) => a.title)).toEqual(['e6', 'e5', 'e4', 'e3', 'e2'])
    dismissActivity(ids[6])
    expect((await current())[0].title).toBe('e5')
  })
})
