import { describe, expect, it, vi } from 'vitest'
import { hydrateService, isServiceAction } from '../src/main/engine/validate'
import { demoService } from '../src/main/service/demoService'
import { ServiceOrder, emptyService, itemContainingSlide, reduceService } from '../src/main/service/serviceOrder'
import type { ServiceItem, ServiceState } from '../src/shared/types'

const mk = (id: string): ServiceItem => ({ id, kind: 'announcement', title: id, slides: [{ id: `${id}-1`, kind: 'announcement', text: id }] })
const withItems = (...ids: string[]): ServiceState => ({ ...emptyService(), items: ids.map(mk) })
const order = (s: ServiceState) => s.items.map((i) => i.id).join(',')

describe('reduceService', () => {
  it('adds at the end by default, or at an index', () => {
    let s = reduceService(withItems('a', 'b'), { type: 'addItem', item: mk('c') })
    expect(order(s)).toBe('a,b,c')
    s = reduceService(s, { type: 'addItem', item: mk('d'), index: 1 })
    expect(order(s)).toBe('a,d,b,c')
  })

  it('clamps an out-of-range index and ignores duplicate ids', () => {
    expect(order(reduceService(withItems('a'), { type: 'addItem', item: mk('b'), index: 99 }))).toBe('a,b')
    expect(order(reduceService(withItems('a'), { type: 'addItem', item: mk('b'), index: -3 }))).toBe('b,a')
    const s = withItems('a')
    expect(reduceService(s, { type: 'addItem', item: mk('a') })).toBe(s)
  })

  it('removes an item, no-op for unknown id', () => {
    expect(order(reduceService(withItems('a', 'b', 'c'), { type: 'removeItem', itemId: 'b' }))).toBe('a,c')
    const s = withItems('a')
    expect(reduceService(s, { type: 'removeItem', itemId: 'zzz' })).toBe(s)
  })

  it('moves an item up and down', () => {
    expect(order(reduceService(withItems('a', 'b', 'c', 'd'), { type: 'moveItem', itemId: 'd', toIndex: 0 }))).toBe('d,a,b,c')
    expect(order(reduceService(withItems('a', 'b', 'c', 'd'), { type: 'moveItem', itemId: 'a', toIndex: 2 }))).toBe('b,c,a,d')
    expect(order(reduceService(withItems('a', 'b'), { type: 'moveItem', itemId: 'a', toIndex: 50 }))).toBe('b,a')
  })

  it('move is a no-op to the same place or for an unknown id', () => {
    const s = withItems('a', 'b')
    expect(reduceService(s, { type: 'moveItem', itemId: 'a', toIndex: 0 })).toBe(s)
    expect(reduceService(s, { type: 'moveItem', itemId: 'x', toIndex: 1 })).toBe(s)
  })

  it('renames, ignoring blank or unchanged titles', () => {
    const s = emptyService()
    expect(reduceService(s, { type: 'renameService', title: '  Easter Sunday ' }).title).toBe('Easter Sunday')
    expect(reduceService(s, { type: 'renameService', title: '   ' })).toBe(s)
    expect(reduceService(s, { type: 'renameService', title: s.title })).toBe(s)
  })
})

describe('itemContainingSlide', () => {
  it('finds the item for the Live slide so the console reopens there', () => {
    const s = demoService()
    expect(itemContainingSlide(s, 'amazing-grace-2')?.title).toBe('Amazing Grace')
    expect(itemContainingSlide(s, 'nope')).toBeUndefined()
    expect(itemContainingSlide(s, undefined)).toBeUndefined()
  })
})

describe('ServiceOrder', () => {
  it('bumps rev and notifies on change only', () => {
    const svc = new ServiceOrder(withItems('a'))
    const listener = vi.fn()
    svc.subscribe(listener)
    expect(svc.dispatch({ type: 'removeItem', itemId: 'x' })).toBe(false)
    expect(svc.dispatch({ type: 'addItem', item: mk('b') })).toBe(true)
    expect(svc.state.rev).toBe(1)
    expect(listener).toHaveBeenCalledOnce()
  })
})

describe('demo service', () => {
  it('is valid and every slide id is unique', () => {
    const s = demoService()
    expect(hydrateService(JSON.parse(JSON.stringify(s)))?.items).toHaveLength(s.items.length)
    const ids = s.items.flatMap((i) => i.slides.map((sl) => sl.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('service validation', () => {
  it('accepts well-formed actions and rejects bad ones', () => {
    expect(isServiceAction({ type: 'addItem', item: mk('a') })).toBe(true)
    expect(isServiceAction({ type: 'moveItem', itemId: 'a', toIndex: 2 })).toBe(true)
    expect(isServiceAction({ type: 'addItem', item: { id: 'a', title: 'x', kind: 'song', slides: [{ id: 1 }] } })).toBe(false)
    expect(isServiceAction({ type: 'moveItem', itemId: 'a' })).toBe(false)
    expect(isServiceAction({ type: 'deleteEverything' })).toBe(false)
  })

  it('hydrate drops broken items and rejects non-services', () => {
    const s = hydrateService({ title: 'Easter', items: [mk('a'), { id: 'bad' }, mk('b')] })
    expect(order(s!)).toBe('a,b')
    expect(s!.title).toBe('Easter')
    expect(hydrateService('junk')).toBeNull()
    expect(hydrateService({ items: 'no' })).toBeNull()
  })
})
