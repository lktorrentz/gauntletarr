import { describe, expect, it } from 'vitest'

import { etaSeconds, formatDuration, percent, runSteps, type RunResponse } from '@/lib/run-progress'

function run(overrides: Partial<RunResponse>): RunResponse {
  return {
    id: 1, run_type: 'manual', started_at: '2026-09-23T10:00:00Z', finished_at: null, current_phase: null,
    phase_total: null, phase_done: null, phase_detail: null, phases: {}, items_scanned: 0, matches_found: 0,
    auto_executed: 0, pending_review: 0, errors: 0, last_error: null, cancel_requested: false, cancelled: false,
    ...overrides,
  }
}

describe('runSteps', () => {
  it('marks finished, running and upcoming phases in pipeline order', () => {
    const steps = runSteps(run({
      phases: {
        scanning: { status: 'done', done: 10, total: 10, skipped: 0 },
        resolving: { status: 'running', done: 2, total: 5, skipped: 0 },
      },
    }))
    expect(steps.map((s) => [s.phase, s.state])).toEqual([
      ['scanning', 'done'], ['resolving', 'running'], ['indexing', 'pending'],
      ['matching', 'pending'], ['executing', 'pending'], ['reconciling', 'pending'],
    ])
  })

  it('never leaves phases pending forever once the run has finished', () => {
    const steps = runSteps(run({
      finished_at: '2026-09-23T10:05:00Z',
      phases: { scanning: { status: 'running', done: 3, total: 10, skipped: 0 } },
    }))
    expect(steps[0].state).toBe('done')
    expect(steps.slice(1).every((s) => s.state === 'skipped')).toBe(true)
  })
})

describe('progress maths', () => {
  it('computes a bounded percentage, null without a total', () => {
    expect(percent(312, 800)).toBe(39)
    expect(percent(900, 800)).toBe(100)
    expect(percent(5, 0)).toBeNull()
    expect(percent(5, null)).toBeNull()
  })

  it('estimates the remaining time from the observed rate', () => {
    const started = '2026-09-23T10:00:00Z'
    const now = new Date('2026-09-23T10:01:40Z').getTime() // 100s dopo
    expect(etaSeconds({ status: 'running', done: 250, total: 1000, skipped: 0, started_at: started }, now)).toBe(300)
    expect(etaSeconds({ status: 'running', done: 1, total: 1000, skipped: 0, started_at: started }, now)).toBeNull()
  })

  it('formats durations as mm:ss or h:mm:ss', () => {
    expect(formatDuration(75)).toBe('01:15')
    expect(formatDuration(3725)).toBe('1:02:05')
  })
})

describe('API dates', () => {
  it('reads dates without a timezone as UTC, like the backend stores them', async () => {
    const { parseApiDate } = await import('@/lib/time')
    expect(parseApiDate('2026-09-24T09:00:00').toISOString()).toBe('2026-09-24T09:00:00.000Z')
    expect(parseApiDate('2026-09-24T09:00:00+00:00').toISOString()).toBe('2026-09-24T09:00:00.000Z')
    expect(parseApiDate('2026-09-24T11:00:00+02:00').toISOString()).toBe('2026-09-24T09:00:00.000Z')
  })
})
