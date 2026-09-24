import { describe, expect, it } from 'vitest'

import { summaryStyle } from '@/lib/status-styles'

describe('summaryStyle', () => {
  it('gives every summary card the colour of its status', () => {
    expect(summaryStyle('seeding').gradient).toContain('emerald')
    expect(summaryStyle('orphan_media').gradient).toContain('red')
    expect(summaryStyle('orphan_torrent').gradient).toContain('red')
    expect(summaryStyle('duplicates').gradient).toContain('violet')
    expect(summaryStyle('review').gradient).toContain('amber')
    expect(summaryStyle('ignored').gradient).toContain('sky')
    expect(summaryStyle('all').gradient).toBe('from-primary/5')
  })
})
