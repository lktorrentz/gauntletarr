import { describe, expect, it } from 'vitest'

import { disabledHosts, parseOrder } from '@/pages/config/ImageHostPriorityField'

const DEFAULT_ORDER = [
  'ptpimg', 'imgbox', 'imgbb', 'pixhost', 'lensdump', 'ptscreens', 'onlyimage', 'dalexni', 'utppm', 'seedpool_cdn',
]

describe('parseOrder', () => {
  it('falls back to every known host, in default order, when never saved', () => {
    expect(parseOrder(null)).toEqual(DEFAULT_ORDER)
    expect(parseOrder(undefined)).toEqual(DEFAULT_ORDER)
    expect(parseOrder('')).toEqual(DEFAULT_ORDER)
  })

  it('respects a saved custom order exactly, including a partial (disabled) subset', () => {
    // Un host esplicitamente rimosso (disabilitato) non deve più
    // ricomparire da solo: unica differenza rispetto al comportamento
    // precedente, ora che esiste uno spegnimento esplicito.
    expect(parseOrder('imgbb,ptpimg')).toEqual(['imgbb', 'ptpimg'])
  })

  it('drops unknown host keys from a stale saved value', () => {
    expect(parseOrder('ptpimg,some-removed-host,imgbox')).toEqual(['ptpimg', 'imgbox'])
  })
})

describe('disabledHosts', () => {
  it('lists known hosts missing from the enabled order', () => {
    expect(disabledHosts(['ptpimg', 'imgbox'])).toEqual(DEFAULT_ORDER.filter((h) => h !== 'ptpimg' && h !== 'imgbox'))
  })

  it('is empty when every known host is enabled', () => {
    expect(disabledHosts(DEFAULT_ORDER)).toEqual([])
  })
})
