import { useEffect, useState } from 'react'
import type { ServiceState } from '../../shared/types'

/** Latest state main has sent this window; outputs render nothing else. */
export function useEngineState<T extends { rev: number }>(): T | null {
  const [state, setState] = useState<T | null>(null)
  useEffect(() => {
    // Drop anything older than what we already show, in case replies cross.
    const accept = (next: unknown) => setState((prev) => (prev && prev.rev > (next as T).rev ? prev : (next as T)))
    const off = window.sc.onState(accept)
    void window.sc.getState().then((s) => s && accept(s))
    return off
  }, [])
  return state
}

/** The running order, console only. */
export function useService(): ServiceState | null {
  const [service, setService] = useState<ServiceState | null>(null)
  useEffect(() => {
    const accept = (next: ServiceState) => setService((prev) => (prev && prev.rev > next.rev ? prev : next))
    const off = window.sc.onService(accept)
    void window.sc.getService().then((s) => s && accept(s))
    return off
  }, [])
  return service
}

/** Re-renders every second, for clocks and timers. */
export function useNow(): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
