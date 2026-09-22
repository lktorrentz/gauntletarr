import { describe, expect, it } from 'vitest'

import { selectLabel } from '@/lib/utils'

interface Item {
  id: string
  label: string
}

const items: Item[] = [
  { id: '1', label: 'movie' },
  { id: '2', label: 'tv' },
]

describe('selectLabel', () => {
  it('returns the placeholder when no value is selected', () => {
    // Il gotcha di Base UI: Select.Value con `children` perde il fallback
    // al `placeholder` automatico, va gestito qui esplicitamente.
    expect(selectLabel(items, null, (i) => i.id, (i) => i.label, 'Scegli…')).toBe('Scegli…')
    expect(selectLabel(items, '', (i) => i.id, (i) => i.label, 'Scegli…')).toBe('Scegli…')
  })

  it('returns the matching item label', () => {
    expect(selectLabel(items, '2', (i) => i.id, (i) => i.label, 'Scegli…')).toBe('tv')
  })

  it('falls back to the raw value when nothing matches', () => {
    expect(selectLabel(items, '99', (i) => i.id, (i) => i.label, 'Scegli…')).toBe('99')
  })

  it('falls back to the raw value when items are not loaded yet', () => {
    expect(selectLabel<Item>(undefined, '2', (i) => i.id, (i) => i.label, 'Scegli…')).toBe('2')
  })
})
