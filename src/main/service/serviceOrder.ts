// Service order (running order) for the current service. Pure, like the engine;
// main owns it, auto-saves it and sends it to the console.

import type { ServiceAction, ServiceItem, ServiceState } from '../../shared/types'

export function emptyService(): ServiceState {
  return { rev: 0, title: 'Sunday Service', items: [] }
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.trunc(n)))

export function reduceService(state: ServiceState, action: ServiceAction): ServiceState {
  switch (action.type) {
    case 'addItem': {
      if (state.items.some((i) => i.id === action.item.id)) return state
      const items = [...state.items]
      items.splice(clamp(action.index ?? items.length, 0, items.length), 0, action.item)
      return { ...state, items }
    }

    case 'removeItem': {
      const items = state.items.filter((i) => i.id !== action.itemId)
      return items.length === state.items.length ? state : { ...state, items }
    }

    case 'moveItem': {
      const from = state.items.findIndex((i) => i.id === action.itemId)
      if (from < 0) return state
      const to = clamp(action.toIndex, 0, state.items.length - 1)
      if (to === from) return state
      const items = [...state.items]
      const [moved] = items.splice(from, 1)
      items.splice(to, 0, moved)
      return { ...state, items }
    }

    case 'renameService': {
      const title = action.title.trim()
      return title && title !== state.title ? { ...state, title } : state
    }
  }
}

/** The item a slide belongs to, used to reopen the console where Live was. */
export function itemContainingSlide(state: ServiceState, slideId: string | undefined): ServiceItem | undefined {
  if (!slideId) return undefined
  return state.items.find((i) => i.slides.some((s) => s.id === slideId))
}

export class ServiceOrder {
  private current: ServiceState
  private listeners = new Set<(s: ServiceState) => void>()

  constructor(initial: ServiceState = emptyService()) {
    this.current = initial
  }

  get state(): ServiceState {
    return this.current
  }

  dispatch(action: ServiceAction): boolean {
    const next = reduceService(this.current, action)
    if (next === this.current) return false
    this.current = { ...next, rev: this.current.rev + 1 }
    for (const l of this.listeners) l(this.current)
    return true
  }

  subscribe(listener: (s: ServiceState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}
