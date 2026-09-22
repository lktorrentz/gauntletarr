import { describe, expect, it } from 'vitest'

import { t } from '@/lib/i18n'

describe('t', () => {
  it('substitutes params into the template', () => {
    expect(t('errors.disk_not_found', { id: 5 })).toBe('Disk 5 not found.')
  })

  it('joins array params with a comma', () => {
    expect(t('errors.tracker_adapter_type_unsupported', { adapter_type: 'x', supported: ['a', 'b'] })).toBe(
      'Unsupported adapter_type: x (supported: a, b)',
    )
  })

  it('leaves a placeholder untouched when the param is missing', () => {
    expect(t('errors.disk_not_found', {})).toBe('Disk {id} not found.')
  })

  it('falls back to the raw key when it has no translation', () => {
    expect(t('errors.not_a_real_code')).toBe('errors.not_a_real_code')
  })
})
