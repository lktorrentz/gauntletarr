import { describe, expect, it } from 'vitest'

import { disabledHosts, parseOrder } from '@/pages/config/ImageHostPriorityField'

describe('parseOrder', () => {
  it('falls back to every known host, in default order, when never saved', () => {
    expect(parseOrder(null)).toEqual(['ptpimg', 'imgbox', 'imgbb', 'pixhost'])
    expect(parseOrder(undefined)).toEqual(['ptpimg', 'imgbox', 'imgbb', 'pixhost'])
    expect(parseOrder('')).toEqual(['ptpimg', 'imgbox', 'imgbb', 'pixhost'])
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
    expect(disabledHosts(['ptpimg', 'imgbox'])).toEqual(['imgbb', 'pixhost'])
  })

  it('is empty when every known host is enabled', () => {
    expect(disabledHosts(['ptpimg', 'imgbox', 'imgbb', 'pixhost'])).toEqual([])
  })
})
