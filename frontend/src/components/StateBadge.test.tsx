import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StateBadge } from '@/components/StateBadge'

describe('StateBadge', () => {
  it.each([
    ['seeding', 'seeding'],
    ['orphan_media', 'orphan media'],
    ['orphan_torrent', 'orphaned'],
    ['ignored', 'ignored'],
    ['unmatched', 'unmatched'],
  ])('renders the label for state %s', (state, expectedLabel) => {
    render(<StateBadge state={state} />)
    expect(screen.getByText(expectedLabel)).toBeInTheDocument()
  })

  it('falls back to the raw state string for an unknown state', () => {
    render(<StateBadge state="something_new" />)
    expect(screen.getByText('something_new')).toBeInTheDocument()
  })
})
