import { describe, expect, it } from 'vitest'

import { parseOrder } from '@/pages/config/ImageHostPriorityField'

describe('parseOrder', () => {
  it('falls back to the default order when the setting was never saved', () => {
    expect(parseOrder(null)).toEqual(['ptpimg', 'imgbox', 'imgbb'])
    expect(parseOrder(undefined)).toEqual(['ptpimg', 'imgbox', 'imgbb'])
    expect(parseOrder('')).toEqual(['ptpimg', 'imgbox', 'imgbb'])
  })

  it('respects a saved custom order', () => {
    expect(parseOrder('imgbb,ptpimg,imgbox')).toEqual(['imgbb', 'ptpimg', 'imgbox'])
  })

  it('appends hosts missing from a saved (partial) order, in default order', () => {
    // Un host mai riordinato non deve sparire dalla UI solo perché non è
    // ancora comparso nella stringa CSV salvata.
    expect(parseOrder('imgbb')).toEqual(['imgbb', 'ptpimg', 'imgbox'])
  })

  it('drops unknown host keys from a stale saved value', () => {
    expect(parseOrder('ptpimg,some-removed-host,imgbox')).toEqual(['ptpimg', 'imgbox', 'imgbb'])
  })
})
